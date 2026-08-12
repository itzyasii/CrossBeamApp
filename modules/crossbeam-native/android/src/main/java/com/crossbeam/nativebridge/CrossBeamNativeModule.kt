package com.crossbeam.nativebridge

import android.Manifest
import android.content.Context
import android.content.ContentValues
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.MediaStore
import android.media.MediaScannerConnection
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.net.wifi.WifiManager
import android.os.Build
import android.os.Environment
import android.util.Log
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.BufferedInputStream
import java.io.BufferedOutputStream
import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.File
import java.io.FileOutputStream
import java.io.RandomAccessFile
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket
import java.security.MessageDigest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.bluetooth.le.BluetoothLeAdvertiser
import android.bluetooth.le.BluetoothLeScanner
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.os.ParcelUuid
import android.content.res.Configuration
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import kotlin.concurrent.thread
import kotlin.math.max
import kotlin.text.Charsets

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import android.util.Base64

import android.net.wifi.p2p.WifiP2pConfig
import android.app.NotificationManager
import android.app.NotificationChannel
import android.app.PendingIntent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import android.net.wifi.p2p.WifiP2pDevice
import android.net.wifi.p2p.WifiP2pManager
import android.content.IntentFilter
import android.content.BroadcastReceiver

class CrossBeamNativeModule : Module() {
  companion object {
    private var INSTANCE: CrossBeamNativeModule? = null
    private val pendingNotificationActions = ConcurrentHashMap<String, Boolean>()

    @JvmStatic
    fun handleNotificationActionFromReceiver(transferId: String, accepted: Boolean) {
      INSTANCE?.onNotificationAction(transferId, accepted)
        ?: run {
          pendingNotificationActions[transferId] = accepted
        }
    }

    @JvmStatic
    fun processPendingNotificationActions() {
      val instance = INSTANCE ?: return
      val snapshot = HashMap(pendingNotificationActions)
      pendingNotificationActions.clear()
      snapshot.forEach { (transferId, accepted) ->
        instance.onNotificationAction(transferId, accepted)
      }
    }
  }
  private var wifiP2pManager: WifiP2pManager? = null
  private var wifiP2pChannel: WifiP2pManager.Channel? = null
  private var wifiP2pReceiver: BroadcastReceiver? = null
  private var wifiP2pConnectionLatch: CountDownLatch? = null
  private var wifiP2pTargetPeerId: String? = null
  @Volatile private var wifiP2pConnectionError: String? = null
  private val wifiP2pIntentFilter = IntentFilter().apply {
    addAction(WifiP2pManager.WIFI_P2P_STATE_CHANGED_ACTION)
    addAction(WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION)
    addAction(WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION)
    addAction(WifiP2pManager.WIFI_P2P_THIS_DEVICE_CHANGED_ACTION)
  }
  private val KEYSTORE_PROVIDER = "AndroidKeyStore"
  private val AES_MODE = "AES/GCM/NoPadding"
  private val peers = ConcurrentHashMap<String, Map<String, Any?>>()
  private var discoveryListener: NsdManager.DiscoveryListener? = null
  private var registrationListener: NsdManager.RegistrationListener? = null
  private var multicastLock: WifiManager.MulticastLock? = null
  private var serverSocket: ServerSocket? = null
  private var serverThread: Thread? = null
  private var localServiceName: String? = null
  private val activeSockets = ConcurrentHashMap<String, Socket>()
  private val activeTransferCount = AtomicInteger(0)
  private val cancelledTransfers = ConcurrentHashMap.newKeySet<String>()
  private val pausedTransfers = ConcurrentHashMap.newKeySet<String>()
  private val pendingIncomingApprovals = ConcurrentHashMap<String, CountDownLatch>()
  private val incomingApprovalResults = ConcurrentHashMap<String, Boolean>()
  private val serviceType = "_crossbeam._tcp."
  private val protocolMagic = "CROSSBEAM1"
  private val chunkedProtocolVersion = 3
  private val transferChunkSize = 1024 * 1024
  private val transferPort = 53_545
  private val DEFAULT_BUFFER_SIZE = 8192
  private val socketConnectTimeoutMs = 10_000
  private val socketReadTimeoutMs = 150_000
  private val maxFileCount = 100
  private val maxFileSize = 100L * 1024L * 1024L * 1024L
  private val maxBatchSize = 200L * 1024L * 1024L * 1024L

  // BLE State
  private var bluetoothAdapter: BluetoothAdapter? = null
  private var bleAdvertiser: BluetoothLeAdvertiser? = null
  private var bleScanner: BluetoothLeScanner? = null
  private val bleServiceUuid = UUID.fromString("63626561-6d2d-7032-702d-646973636f76") // "cbeam-p2p-discov"
  private var bleAdvertiseCallback: AdvertiseCallback? = null
  private var bleScanCallback: ScanCallback? = null
  private var localDeviceKey: String? = null

  private fun appContext(): Context? = appContext.reactContext

  private fun getOrCreateDeviceKey(context: Context): String {
    localDeviceKey?.let { return it }
    val prefs = context.getSharedPreferences("crossbeam", Context.MODE_PRIVATE)
    val stored = prefs.getString("deviceKey", null)?.takeIf { it.isNotBlank() }
    if (stored != null) {
      localDeviceKey = stored
      return stored
    }
    val generated = UUID.randomUUID().toString().replace("-", "").take(12)
    prefs.edit().putString("deviceKey", generated).apply()
    localDeviceKey = generated
    return generated
  }

  private fun getFriendlyDeviceName(context: Context): String {
    if (hasBluetoothConnectPermission(context)) {
      bluetoothAdapter?.name?.takeIf { it.isNotBlank() }?.let { return it }
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N_MR1) {
      val settingsName = android.provider.Settings.Global.getString(
        context.contentResolver,
        android.provider.Settings.Global.DEVICE_NAME
      )
      if (!settingsName.isNullOrBlank()) return settingsName
    }
    return Build.MODEL?.takeIf { it.isNotBlank() }
      ?: Build.DEVICE?.takeIf { it.isNotBlank() }
      ?: "CrossBeam Device"
  }

  private fun canonicalPeerId(deviceKey: String) = "peer-$deviceKey"

  private fun isPoorPeerName(name: String?): Boolean {
    if (name.isNullOrBlank()) return true
    if (name == "Unknown BLE Peer") return true
    if (Regex("^(\\d{1,3}\\.){3}\\d{1,3}$").matches(name)) return true
    if (name.startsWith("ble-") || name.startsWith("peer-")) return true
    return false
  }

  private fun bestPeerName(primary: String?, fallback: String?): String {
    if (!isPoorPeerName(primary)) return primary!!
    if (!isPoorPeerName(fallback)) return fallback!!
    return primary?.takeIf { it.isNotBlank() }
      ?: fallback?.takeIf { it.isNotBlank() }
      ?: "Nearby Device"
  }

  private fun deviceKeyFromServiceName(serviceName: String): String? {
    if (!serviceName.startsWith("CrossBeam-")) return null
    return serviceName.removePrefix("CrossBeam-").takeIf { it.isNotBlank() }
  }

  private fun hasTransferEndpoint(peer: Map<String, Any?>): Boolean {
    val host = peer["host"] as? String
    val port = peer["port"] as? Number
    return !host.isNullOrBlank() && port != null && port.toInt() > 0
  }

  private fun isWifiDirectKey(deviceKey: String): Boolean = deviceKey.startsWith("wifi-")

  private fun normalizedPeerName(name: String?): String? {
    if (isPoorPeerName(name) || name == "Nearby Device") return null
    return name!!.trim().lowercase().replace(Regex("\\s+"), " ")
  }

  private fun routeRank(peer: Map<String, Any?>): Int {
    val endpointBonus = if (hasTransferEndpoint(peer)) 10 else 0
    return endpointBonus + when (peer["connection"] as? String) {
      "local-network" -> 4
      "wifi-direct" -> 3
      "multipeer" -> 2
      else -> 1
    }
  }

  private fun peerConnections(peer: Map<String, Any?>): Set<String> {
    val advertised = (peer["availableConnections"] as? List<*>)
      ?.mapNotNull { it as? String }
      ?.toSet()
      ?: emptySet()
    val connection = peer["connection"] as? String
    return if (connection != null) advertised + connection else advertised
  }

  private fun mergePeerMaps(a: Map<String, Any?>, b: Map<String, Any?>): Map<String, Any?> {
    val transferPeer = if (routeRank(b) > routeRank(a)) b else a
    val other = if (transferPeer == b) a else b
    val deviceKey = listOfNotNull(a["deviceKey"] as? String, b["deviceKey"] as? String)
      .firstOrNull { !isWifiDirectKey(it) }
      ?: (transferPeer["deviceKey"] as? String)
      ?: (other["deviceKey"] as? String)
      ?: transferPeer["id"] as String
    val connections = (peerConnections(a) + peerConnections(b)).sortedByDescending {
      when (it) {
        "local-network" -> 4
        "wifi-direct" -> 3
        "multipeer" -> 2
        else -> 1
      }
    }

    return mapOf(
      "id" to canonicalPeerId(deviceKey),
      "deviceKey" to deviceKey,
      "name" to bestPeerName(transferPeer["name"] as? String, other["name"] as? String),
      "platform" to (transferPeer["platform"] ?: other["platform"] ?: "android"),
      "connection" to (transferPeer["connection"] ?: "ble"),
      "availableConnections" to connections,
      "host" to transferPeer["host"],
      "port" to transferPeer["port"],
      "wifiDirectAddress" to (transferPeer["wifiDirectAddress"] ?: other["wifiDirectAddress"]),
      "availability" to if (hasTransferEndpoint(transferPeer)) "ready" else
        (transferPeer["availability"] ?: other["availability"] ?: "discovered"),
      "isTransferReady" to hasTransferEndpoint(transferPeer),
      "statusMessage" to (transferPeer["statusMessage"] ?: other["statusMessage"]),
      "isTrusted" to false,
      "lastSeenAt" to max(
        (transferPeer["lastSeenAt"] as? Number)?.toLong() ?: 0L,
        (other["lastSeenAt"] as? Number)?.toLong() ?: 0L
      )
    )
  }

  private fun findPeerByDeviceKey(deviceKey: String): Map<String, Any?>? =
    peers.values.firstOrNull { (it["deviceKey"] as? String) == deviceKey }

  private fun removePeersExcept(keepId: String, deviceKey: String) {
    peers.entries.removeIf { entry ->
      entry.key != keepId && (entry.value["deviceKey"] as? String) == deviceKey
    }
  }

  private fun upsertPeer(incoming: Map<String, Any?>): Map<String, Any?> {
    val rawDeviceKey = incoming["deviceKey"] as? String ?: incoming["id"] as String
    val incomingName = normalizedPeerName(incoming["name"] as? String)
    val correlated = if (incomingName != null) {
      val candidates = peers.values
        .filter { normalizedPeerName(it["name"] as? String) == incomingName }
        .distinctBy { it["deviceKey"] as? String ?: it["id"] as String }
      if (isWifiDirectKey(rawDeviceKey)) {
        candidates.filter { !isWifiDirectKey(it["deviceKey"] as? String ?: "wifi-") }
          .singleOrNull()
      } else {
        candidates.filter { isWifiDirectKey(it["deviceKey"] as? String ?: "") }
          .singleOrNull()
      }
    } else {
      null
    }
    val correlatedKey = correlated?.get("deviceKey") as? String
    val deviceKey = when {
      !isWifiDirectKey(rawDeviceKey) -> rawDeviceKey
      correlatedKey != null && !isWifiDirectKey(correlatedKey) -> correlatedKey
      else -> rawDeviceKey
    }
    val normalized = incoming.toMutableMap().apply {
      put("deviceKey", deviceKey)
      put("id", canonicalPeerId(deviceKey))
      put("availableConnections", peerConnections(incoming).toList())
    }

    val existing = findPeerByDeviceKey(deviceKey)
      ?: correlated
      ?: peers[normalized["id"] as String]
      ?: peers[incoming["id"] as String]

    val merged = if (existing != null) mergePeerMaps(normalized, existing) else normalized
    val correlatedId = correlated?.get("id") as? String
    val obsoleteIds = peers.entries
      .filter { (_, peer) ->
        normalizedPeerName(peer["name"] as? String) == incomingName &&
          (peer["deviceKey"] == rawDeviceKey || peer["id"] == incoming["id"] || peer["id"] == correlatedId)
      }
      .map { it.key }
    removePeersExcept(merged["id"] as String, deviceKey)
    obsoleteIds.forEach { obsoleteId ->
      if (obsoleteId != merged["id"] && peers.remove(obsoleteId) != null) {
        sendEvent("onPeerLost", mapOf("id" to obsoleteId))
      }
    }
    peers[merged["id"] as String] = merged
    sendEvent("onPeerFound", merged)
    return merged
  }

  private fun visiblePeers(): List<Map<String, Any?>> {
    val grouped = peers.values.groupBy { it["deviceKey"] as? String ?: it["id"] as String }
    return grouped.values.map { group ->
      group.reduce { acc, peer -> mergePeerMaps(acc, peer) }
    }
  }

  private fun resolvePeer(peerId: String): Map<String, Any?>? {
    peers[peerId]?.let { peer ->
      if (hasTransferEndpoint(peer)) return peer
      val deviceKey = peer["deviceKey"] as? String ?: return null
      return findPeerByDeviceKey(deviceKey)?.takeIf { hasTransferEndpoint(it) }
    }

    val deviceKey = when {
      peerId.startsWith("peer-") -> peerId.removePrefix("peer-")
      peerId.startsWith("ble-") -> peerId.removePrefix("ble-")
      else -> deviceKeyFromServiceName(peerId)
    }

    if (!deviceKey.isNullOrBlank()) {
      findPeerByDeviceKey(deviceKey)?.takeIf { hasTransferEndpoint(it) }?.let { return it }
    }

    return peers.values.firstOrNull { it["id"] == peerId && hasTransferEndpoint(it) }
  }

  private fun parseBleDeviceKey(result: ScanResult): String? {
    val serviceData = result.scanRecord?.getServiceData(ParcelUuid(bleServiceUuid))
    return serviceData?.toString(Charsets.UTF_8)?.takeIf { it.isNotBlank() }
  }

  private fun parseBleDeviceName(result: ScanResult): String? {
    result.scanRecord?.deviceName?.takeIf { !isPoorPeerName(it) }?.let { return it }
    result.device.name?.takeIf { !isPoorPeerName(it) }?.let { return it }
    return null
  }

  override fun definition() = ModuleDefinition {
    Name("CrossBeamNative")

    OnCreate {
      val context = appContext.reactContext ?: return@OnCreate
      INSTANCE = this@CrossBeamNativeModule
      processPendingNotificationActions()
      val bluetoothManager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
      bluetoothAdapter = bluetoothManager?.adapter
      if (bluetoothAdapter != null) {
        bleAdvertiser = bluetoothAdapter?.bluetoothLeAdvertiser
        bleScanner = bluetoothAdapter?.bluetoothLeScanner
      }
    }

    OnDestroy {
      try {
        stopWifiP2pDiscovery()
        stopNsdDiscovery()
        unregisterLocalService()
        stopTransferServer()
        stopBleDiscovery()
        releaseMulticastLock()
      } catch (_: Exception) {}
    }

    Events(
      "onPeerFound",
      "onPeerLost",
      "onTransferProgress",
      "onIncomingTransferRequest",
      "onWiFiDirectPeersChanged",
      "onWiFiDirectConnectionChanged"
    )

    AsyncFunction("isAvailable") {
      true
    }

    AsyncFunction("getPlatformCapabilities") {
      val capabilities = mutableListOf(
        "local-network-discovery",
        "local-network-advertising",
        "socket-stream-transfer",
        "app-managed-chunk-stream",
        "chunk-ack-resume",
        "sha256-integrity",
        "ble-discovery",
        "ble-advertising"
      )
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        capabilities.add("wifi-direct-api-available")
      }
      val context = appContext.reactContext
      if (context != null && isAndroidTv(context)) {
        capabilities.add("remote-control-focus")
        capabilities.add("leanback-launcher")
        capabilities.add("tv-receiver-mode")
      }
      capabilities
    }

    AsyncFunction("getChunkProtocol") {
      mapOf(
        "protocol" to "crossbeam-chunk-v3",
        "version" to chunkedProtocolVersion,
        "chunkSizeBytes" to transferChunkSize,
        "supportsChunkAck" to true,
        "supportsPause" to true,
        "supportsResume" to true,
        "supportsRetry" to false
      )
    }

    AsyncFunction("showIncomingNotification") { transferId: String, title: String, body: String ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      val channelId = "incoming-transfers"
      val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return@AsyncFunction false
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val chan = NotificationChannel(channelId, "Incoming Transfers", NotificationManager.IMPORTANCE_HIGH)
        chan.enableVibration(true)
        chan.vibrationPattern = longArrayOf(0, 250, 180, 250)
        nm.createNotificationChannel(chan)
      }

      val acceptIntent = Intent(context, NotificationActionReceiver::class.java).apply {
        action = "com.crossbeam.ACTION_INCOMING_TRANSFER"
        putExtra("transferId", transferId)
        putExtra("action", "accept")
      }
      val rejectIntent = Intent(context, NotificationActionReceiver::class.java).apply {
        action = "com.crossbeam.ACTION_INCOMING_TRANSFER"
        putExtra("transferId", transferId)
        putExtra("action", "reject")
      }

      val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE else PendingIntent.FLAG_UPDATE_CURRENT
      val acceptPending = PendingIntent.getBroadcast(context, transferId.hashCode(), acceptIntent, flags)
      val rejectPending = PendingIntent.getBroadcast(context, transferId.hashCode() xor 0x1, rejectIntent, flags)

      val builder = NotificationCompat.Builder(context, channelId)
        .setContentTitle(title)
        .setContentText(body)
        .setSmallIcon(android.R.drawable.stat_sys_upload)
        .setPriority(NotificationCompat.PRIORITY_HIGH)
        .setAutoCancel(true)
        .addAction(0, "Accept", acceptPending)
        .addAction(0, "Reject", rejectPending)

      NotificationManagerCompat.from(context).notify(transferId.hashCode(), builder.build())
      true
    }

    AsyncFunction("dismissIncomingNotification") { transferId: String ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      NotificationManagerCompat.from(context).cancel(transferId.hashCode())
      true
    }

    AsyncFunction("startForegroundService") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      try {
        val intent = Intent(context, ForegroundTransferService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          context.startForegroundService(intent)
        } else {
          context.startService(intent)
        }
        true
      } catch (e: Exception) {
        false
      }
    }

    AsyncFunction("stopForegroundService") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      try {
        val intent = Intent(context, ForegroundTransferService::class.java)
        context.stopService(intent)
        true
      } catch (e: Exception) {
        false
      }
    }

    AsyncFunction("startDiscovery") {
      runCatching { startTransferServer() }.onFailure { Log.e("CrossBeamNative", "Failed to start transfer server", it) }
      runCatching { registerLocalService() }.onFailure { Log.e("CrossBeamNative", "Failed to register local service", it) }
      runCatching { startNsdDiscovery() }.onFailure { Log.e("CrossBeamNative", "Failed to start NSD discovery", it) }
      runCatching {
        initWifiP2p()
        startWifiP2pDiscovery()
      }.onFailure { Log.w("CrossBeamNative", "Wi-Fi Direct discovery unavailable", it) }
      runCatching {
        startBleDiscovery()
      }.onFailure { Log.w("CrossBeamNative", "BLE discovery unavailable", it) }
    }

    AsyncFunction("stopDiscovery") {
      stopWifiP2pDiscovery()
      stopNsdDiscovery()
      unregisterLocalService()
      stopTransferServer()
      stopBleDiscovery()
      releaseMulticastLock()
    }

    AsyncFunction("getDiscoveredPeers") {
      visiblePeers()
    }

    AsyncFunction("connectToWifiDirectPeer") { peerId: String ->
      connectWifiDirectPeer(peerId)
    }

    AsyncFunction("disconnectWifiDirect") {
      disconnectWifiDirectGroup()
    }

    AsyncFunction("cleanupPartialTransfers") { maxAgeMs: Long ->
      cleanupPartialTransfers(maxAgeMs)
    }

    AsyncFunction("respondToIncomingTransfer") { transferId: String, accepted: Boolean ->
      incomingApprovalResults[transferId] = accepted
      pendingIncomingApprovals.remove(transferId)?.countDown()
    }

    // Called from native BroadcastReceiver to handle notification action without JS
    // This delegates to the same approval flow used by JS responders.
    AsyncFunction("_noop_for_receiver") {
      // placeholder to ensure module exports exist for the receiver path
      true
    }

    AsyncFunction("sendFiles") { request: Map<String, Any?> ->
      val peerId = request["peerId"] as? String
        ?: throw IllegalArgumentException("Missing peerId")
      @Suppress("UNCHECKED_CAST")
      val files = request["files"] as? List<Map<String, Any?>>
        ?: throw IllegalArgumentException("Missing files")
      var peer = resolvePeer(peerId)
      if (peer == null && peers[peerId]?.get("connection") == "wifi-direct") {
        peer = connectWifiDirectPeer(peerId)
      }
      val transferPeer = peer ?: throw IllegalArgumentException("Peer is not transfer-ready")
      val host = transferPeer["host"] as? String
        ?: throw IllegalArgumentException("Peer host is unavailable")
      val port = (transferPeer["port"] as? Number)?.toInt()
        ?: throw IllegalArgumentException("Peer port is unavailable")
      val transferId = UUID.randomUUID().toString()
      val resolvedPeerId = transferPeer["id"] as String
      sendFilesToPeer(transferId, host, port, resolvedPeerId, files)
      mapOf("transferId" to transferId)
    }

    AsyncFunction("cancelTransfer") { transferId: String ->
      cancelledTransfers.add(transferId)
      incomingApprovalResults[transferId] = false
      pendingIncomingApprovals.remove(transferId)?.countDown()
      activeSockets.remove(transferId)?.close()
      emitTransfer(transferId, "unknown-peer", null, 0, 1, "cancelled", null)
    }

    AsyncFunction("pauseTransfer") { transferId: String ->
      pausedTransfers.add(transferId)
      emitTransfer(transferId, "unknown-peer", null, 0, 1, "paused", null)
    }

    AsyncFunction("resumeTransfer") { transferId: String ->
      pausedTransfers.remove(transferId)
      // Resume logic: In this simple implementation, the user should re-trigger 
      // the send, and the existing offset logic handles the rest.
      // However, for an active socket, we can just let it spin or signal it.
      emitTransfer(transferId, "unknown-peer", null, 0, 1, "in-progress", null)
    }

    // Phase B: Authentication & Security (Keystore)
    AsyncFunction("storeSecureValue") { alias: String, value: String ->
      val key = getOrCreateSecretKey(alias)
      val cipher = Cipher.getInstance(AES_MODE)
      cipher.init(Cipher.ENCRYPT_MODE, key)
      val iv = cipher.iv
      val encryption = cipher.doFinal(value.toByteArray(Charsets.UTF_8))
      
      val combined = ByteArray(iv.size + encryption.size)
      System.arraycopy(iv, 0, combined, 0, iv.size)
      System.arraycopy(encryption, 0, combined, iv.size, encryption.size)
      
      Base64.encodeToString(combined, Base64.DEFAULT)
    }

    AsyncFunction("retrieveSecureValue") { alias: String, encryptedValue: String ->
      val key = getSecretKey(alias) ?: throw Exception("Key not found")
      val combined = Base64.decode(encryptedValue, Base64.DEFAULT)
      
      val ivSize = 12 // GCM default IV size
      val iv = combined.sliceArray(0 until ivSize)
      val encryption = combined.sliceArray(ivSize until combined.size)
      
      val cipher = Cipher.getInstance(AES_MODE)
      val spec = GCMParameterSpec(128, iv)
      cipher.init(Cipher.DECRYPT_MODE, key, spec)
      
      val decrypted = cipher.doFinal(encryption)
      String(decrypted, Charsets.UTF_8)
    }
  }

  // Instance-level handler invoked by companion when receiver receives an action
  // Not exposed to JS directly.
  // (keeps access to pendingIncomingApprovals map)
  private fun onNotificationAction(transferId: String, accepted: Boolean) {
    incomingApprovalResults[transferId] = accepted
    pendingIncomingApprovals.remove(transferId)?.countDown()
  }

  private fun getOrCreateSecretKey(alias: String): SecretKey {
    val keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER).apply { load(null) }
    if (keyStore.containsAlias(alias)) {
      return (keyStore.getEntry(alias, null) as KeyStore.SecretKeyEntry).secretKey
    }

    val keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE_PROVIDER)
    val spec = KeyGenParameterSpec.Builder(
      alias,
      KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
    )
      .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
      .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
      .setRandomizedEncryptionRequired(true)
      .build()

    keyGenerator.init(spec)
    return keyGenerator.generateKey()
  }

  private fun getSecretKey(alias: String): SecretKey? {
    val keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER).apply { load(null) }
    if (!keyStore.containsAlias(alias)) return null
    return (keyStore.getEntry(alias, null) as KeyStore.SecretKeyEntry).secretKey
  }

  private fun isAndroidTv(context: Context): Boolean {
    val mode = context.resources.configuration.uiMode and Configuration.UI_MODE_TYPE_MASK
    return mode == Configuration.UI_MODE_TYPE_TELEVISION
  }

  private fun localPlatform(context: Context): String =
    if (isAndroidTv(context)) "android-tv" else "android"

  private fun resolvePeerDisplayName(peerId: String): String {
    peers.values.firstOrNull { (it["host"] as? String) == peerId }?.let { peer ->
      (peer["name"] as? String)?.takeIf { !isPoorPeerName(it) }?.let { return it }
    }
    return if (isPoorPeerName(peerId)) "Nearby Device" else peerId
  }

  private fun waitForIncomingApproval(transferId: String, timeoutMs: Long = 120_000L): Boolean {
    val latch = CountDownLatch(1)
    pendingIncomingApprovals[transferId] = latch
    return try {
      val completed = latch.await(timeoutMs, TimeUnit.MILLISECONDS)
      completed && incomingApprovalResults.remove(transferId) == true
    } finally {
      pendingIncomingApprovals.remove(transferId)
      incomingApprovalResults.remove(transferId)
    }
  }

  private fun emitIncomingTransferRequest(
    transferId: String,
    peerId: String,
    fileNames: List<String>,
    sizeBytes: Long
  ) {
    sendEvent(
      "onIncomingTransferRequest",
      mapOf(
        "transferId" to transferId,
        "peerId" to peerId,
        "peerName" to resolvePeerDisplayName(peerId),
        "fileNames" to fileNames,
        "sizeBytes" to sizeBytes,
        "requestedAt" to System.currentTimeMillis()
      )
    )
  }

  private fun inferPeerPlatform(name: String?, fallback: String = "android"): String {
    val normalized = name?.lowercase() ?: return fallback
    return if (
      normalized.contains("tv") ||
      normalized.contains("shield") ||
      normalized.contains("chromecast") ||
      normalized.contains("living room")
    ) {
      "android-tv"
    } else {
      fallback
    }
  }

  private fun hasPermission(context: Context, permission: String): Boolean =
    ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED

  private fun hasBluetoothScanPermission(context: Context): Boolean =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
      hasPermission(context, Manifest.permission.BLUETOOTH_SCAN)

  private fun hasBluetoothConnectPermission(context: Context): Boolean =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
      hasPermission(context, Manifest.permission.BLUETOOTH_CONNECT)

  private fun hasBluetoothAdvertisePermission(context: Context): Boolean =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
      hasPermission(context, Manifest.permission.BLUETOOTH_ADVERTISE)

  private fun hasNearbyWifiPermission(context: Context): Boolean =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
      hasPermission(context, Manifest.permission.NEARBY_WIFI_DEVICES)

  private fun acquireMulticastLock(context: Context) {
    if (multicastLock?.isHeld == true) return
    val wifiManager =
      context.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager ?: return
    multicastLock = wifiManager.createMulticastLock("CrossBeamNsd").apply {
      setReferenceCounted(false)
      acquire()
    }
  }

  private fun releaseMulticastLock() {
    try {
      if (multicastLock?.isHeld == true) multicastLock?.release()
    } catch (_: Exception) {
    } finally {
      multicastLock = null
    }
  }

  private fun initWifiP2p() {
    val context = appContext.reactContext ?: return
    if (wifiP2pManager != null) return
    if (!hasNearbyWifiPermission(context)) return

    wifiP2pManager = context.getSystemService(Context.WIFI_P2P_SERVICE) as? WifiP2pManager
    wifiP2pChannel = wifiP2pManager?.initialize(context, context.mainLooper, null)
    
    wifiP2pReceiver = object : BroadcastReceiver() {
      override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
          WifiP2pManager.WIFI_P2P_STATE_CHANGED_ACTION -> {
            val enabled = intent.getIntExtra(
              WifiP2pManager.EXTRA_WIFI_STATE,
              WifiP2pManager.WIFI_P2P_STATE_DISABLED
            ) == WifiP2pManager.WIFI_P2P_STATE_ENABLED
            if (!enabled) {
              peers.values
                .filter { it["connection"] == "wifi-direct" && !hasTransferEndpoint(it) }
                .forEach { peer ->
                  upsertPeer(peer.toMutableMap().apply {
                    put("availability", "unavailable")
                    put("isTransferReady", false)
                    put("statusMessage", "Turn on Wi-Fi to use Wi-Fi Direct")
                    put("lastSeenAt", System.currentTimeMillis())
                  })
                }
            }
          }
          WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION -> {
            if (!hasNearbyWifiPermission(context)) return
            wifiP2pManager?.requestPeers(wifiP2pChannel) { peersList ->
              val peerMapList = peersList.deviceList.map { device ->
                val deviceKey = "wifi-${device.deviceAddress.replace(":", "")}"
                val availability = when (device.status) {
                  WifiP2pDevice.INVITED, WifiP2pDevice.CONNECTED -> "connecting"
                  WifiP2pDevice.FAILED, WifiP2pDevice.UNAVAILABLE -> "unavailable"
                  else -> "discovered"
                }
                val statusMessage = when (device.status) {
                  WifiP2pDevice.INVITED -> "Wi-Fi Direct invitation sent"
                  WifiP2pDevice.CONNECTED -> "Establishing direct transfer route"
                  WifiP2pDevice.FAILED -> "Wi-Fi Direct connection failed; refresh to retry"
                  WifiP2pDevice.UNAVAILABLE -> "Wi-Fi Direct peer is currently unavailable"
                  else -> "Nearby over Wi-Fi Direct; tap Connect"
                }
                val peer = mapOf(
                  "id" to canonicalPeerId(deviceKey),
                  "deviceKey" to deviceKey,
                  "name" to device.deviceName,
                  "platform" to inferPeerPlatform(device.deviceName),
                  "connection" to "wifi-direct",
                  "wifiDirectAddress" to device.deviceAddress,
                  "availability" to availability,
                  "isTransferReady" to false,
                  "statusMessage" to statusMessage,
                  "lastSeenAt" to System.currentTimeMillis(),
                  "status" to when (device.status) {
                    WifiP2pDevice.AVAILABLE -> "available"
                    WifiP2pDevice.INVITED -> "invited"
                    WifiP2pDevice.CONNECTED -> "connected"
                    WifiP2pDevice.FAILED -> "failed"
                    WifiP2pDevice.UNAVAILABLE -> "unavailable"
                    else -> "unknown"
                  }
                )
                upsertPeer(peer)
                peer
              }
              sendEvent("onWiFiDirectPeersChanged", mapOf("peers" to peerMapList))
            }
          }
          WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION -> {
            wifiP2pManager?.requestConnectionInfo(wifiP2pChannel) { info ->
              val targetId = wifiP2pTargetPeerId
              if (info.groupFormed && targetId != null) {
                if (info.isGroupOwner) {
                  wifiP2pConnectionError = "This device became the Wi-Fi Direct group owner. Retry from the sending device."
                } else {
                  val peer = peers[targetId]
                  if (peer != null && info.groupOwnerAddress != null) {
                    upsertPeer(
                      peer.toMutableMap().apply {
                        put("host", info.groupOwnerAddress.hostAddress)
                        put("port", transferPort)
                        put("connection", "wifi-direct")
                        put("availability", "ready")
                        put("isTransferReady", true)
                        put("statusMessage", "Connected over Wi-Fi Direct")
                        put("lastSeenAt", System.currentTimeMillis())
                      }
                    )
                  }
                }
                wifiP2pConnectionLatch?.countDown()
              }
              sendEvent(
                "onWiFiDirectConnectionChanged",
                mapOf(
                  "groupFormed" to info.groupFormed,
                  "isGroupOwner" to info.isGroupOwner,
                  "groupOwnerHost" to info.groupOwnerAddress?.hostAddress,
                  "error" to wifiP2pConnectionError
                )
              )
            }
          }
        }
      }
    }
    ContextCompat.registerReceiver(
      context,
      wifiP2pReceiver,
      wifiP2pIntentFilter,
      ContextCompat.RECEIVER_NOT_EXPORTED
    )
  }

  private fun startWifiP2pDiscovery() {
    val context = appContext.reactContext ?: return
    val channel = wifiP2pChannel ?: return
    if (!hasNearbyWifiPermission(context)) return
    wifiP2pManager?.discoverPeers(channel, object : WifiP2pManager.ActionListener {
      override fun onSuccess() = Unit
      override fun onFailure(reason: Int) = Unit
    })
  }

  private fun stopWifiP2pDiscovery() {
    val channel = wifiP2pChannel
    if (channel != null) {
      runCatching {
        wifiP2pManager?.stopPeerDiscovery(channel, object : WifiP2pManager.ActionListener {
          override fun onSuccess() = Unit
          override fun onFailure(reason: Int) = Unit
        })
      }
    }
    
    val context = appContext.reactContext ?: return
    wifiP2pReceiver?.let {
      try {
        context.unregisterReceiver(it)
      } catch (_: Exception) {}
    }
    wifiP2pReceiver = null
    wifiP2pManager = null
    wifiP2pChannel = null
  }

  private fun connectWifiDirectPeer(peerId: String): Map<String, Any?> {
    val context = appContext.reactContext ?: throw IllegalStateException("Android context is unavailable")
    if (!hasNearbyWifiPermission(context)) {
      throw SecurityException("Nearby Wi-Fi permission is required")
    }
    initWifiP2p()
    val manager = wifiP2pManager ?: throw IllegalStateException("Wi-Fi Direct is unavailable")
    val channel = wifiP2pChannel ?: throw IllegalStateException("Wi-Fi Direct channel is unavailable")
    val peer = peers[peerId] ?: throw IllegalArgumentException("Wi-Fi Direct peer is no longer available")
    val address = peer["wifiDirectAddress"] as? String
      ?: throw IllegalArgumentException("Wi-Fi Direct address is unavailable")

    wifiP2pConnectionError = null
    wifiP2pTargetPeerId = peerId
    val latch = CountDownLatch(1)
    wifiP2pConnectionLatch = latch
    upsertPeer(
      peer.toMutableMap().apply {
        put("availability", "connecting")
        put("isTransferReady", false)
        put("statusMessage", "Negotiating Wi-Fi Direct connection")
        put("lastSeenAt", System.currentTimeMillis())
      }
    )

    val config = WifiP2pConfig().apply {
      deviceAddress = address
      groupOwnerIntent = 0
    }
    manager.connect(channel, config, object : WifiP2pManager.ActionListener {
      override fun onSuccess() = Unit
      override fun onFailure(reason: Int) {
        wifiP2pConnectionError = "Wi-Fi Direct connection failed ($reason)"
        latch.countDown()
      }
    })

    val completed = latch.await(35, TimeUnit.SECONDS)
    wifiP2pConnectionLatch = null
    if (!completed) {
      wifiP2pConnectionError = "Wi-Fi Direct connection timed out"
    }
    val connected = resolvePeer(peerId)
    if (connected != null) return connected

    val message = wifiP2pConnectionError ?: "Wi-Fi Direct peer did not expose a transfer endpoint"
    upsertPeer(
      peer.toMutableMap().apply {
        put("availability", "unavailable")
        put("isTransferReady", false)
        put("statusMessage", message)
        put("lastSeenAt", System.currentTimeMillis())
      }
    )
    throw IllegalStateException(message)
  }

  private fun disconnectWifiDirectGroup() {
    val manager = wifiP2pManager ?: return
    val channel = wifiP2pChannel ?: return
    manager.removeGroup(channel, object : WifiP2pManager.ActionListener {
      override fun onSuccess() = Unit
      override fun onFailure(reason: Int) {
        Log.w("CrossBeamNative", "Failed to remove Wi-Fi Direct group: $reason")
      }
    })
    wifiP2pTargetPeerId = null
    wifiP2pConnectionError = null
  }

  private fun cleanupPartialTransfers(maxAgeMs: Long): Int {
    val context = appContext.reactContext ?: return 0
    val safeAge = max(maxAgeMs, 60_000L)
    val cutoff = System.currentTimeMillis() - safeAge
    val directory = File(context.filesDir, "crossbeam-partials")
    if (!directory.isDirectory) return 0
    var deleted = 0
    directory.listFiles()?.forEach { file ->
      if (file.isFile && file.name.endsWith(".crossbeam-part") && file.lastModified() < cutoff) {
        if (file.delete()) deleted += 1
      }
    }
    return deleted
  }
  private fun startTransferServer() {
    if (serverSocket != null) return
    val socket = ServerSocket().apply {
      reuseAddress = true
      bind(InetSocketAddress(transferPort))
    }
    serverSocket = socket
    serverThread = thread(name = "CrossBeamTransferServer", isDaemon = true) {
      while (!socket.isClosed) {
        try {
          val client = socket.accept()
          thread(name = "CrossBeamIncomingTransfer", isDaemon = true) {
            receiveFilesFromPeer(client)
          }
        } catch (_: Exception) {
          if (!socket.isClosed) {
            // Keep the server alive for future connections.
          }
        }
      }
    }
  }

  private fun stopTransferServer() {
    try {
      serverSocket?.close()
    } catch (_: Exception) {
    } finally {
      serverSocket = null
      serverThread = null
    }
  }

  private fun registerLocalService() {
    if (registrationListener != null) return
    val context = appContext() ?: return
    val port = serverSocket?.localPort ?: return
    acquireMulticastLock(context)
    val nsdManager = context.getSystemService(Context.NSD_SERVICE) as? NsdManager ?: return
    val deviceKey = getOrCreateDeviceKey(context)
    val friendlyName = getFriendlyDeviceName(context)
    val serviceName = "CrossBeam-$deviceKey"
    localServiceName = serviceName

    val serviceInfo = NsdServiceInfo().apply {
      this.serviceName = serviceName
      this.serviceType = this@CrossBeamNativeModule.serviceType
      this.port = port
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
        setAttribute("platform", localPlatform(context))
        setAttribute("deviceName", friendlyName)
        setAttribute("deviceKey", deviceKey)
      }
    }

    val listener = object : NsdManager.RegistrationListener {
      override fun onServiceRegistered(info: NsdServiceInfo) {
        localServiceName = info.serviceName
      }

      override fun onRegistrationFailed(info: NsdServiceInfo, errorCode: Int) {
        registrationListener = null
      }

      override fun onServiceUnregistered(info: NsdServiceInfo) {
        registrationListener = null
      }

      override fun onUnregistrationFailed(info: NsdServiceInfo, errorCode: Int) {
        registrationListener = null
      }
    }

    registrationListener = listener
    nsdManager.registerService(serviceInfo, NsdManager.PROTOCOL_DNS_SD, listener)
  }

  private fun unregisterLocalService() {
    val context = appContext.reactContext ?: return
    val listener = registrationListener ?: return
    val nsdManager = context.getSystemService(Context.NSD_SERVICE) as? NsdManager ?: return
    try {
      nsdManager.unregisterService(listener)
    } catch (_: IllegalArgumentException) {
    } finally {
      registrationListener = null
    }
  }

  private fun startNsdDiscovery() {
    if (discoveryListener != null) return

    val context = appContext.reactContext ?: return
    acquireMulticastLock(context)
    val nsdManager = context.getSystemService(Context.NSD_SERVICE) as? NsdManager ?: return

    val listener = object : NsdManager.DiscoveryListener {
      override fun onStartDiscoveryFailed(serviceType: String?, errorCode: Int) {
        stopNsdDiscovery()
      }

      override fun onStopDiscoveryFailed(serviceType: String?, errorCode: Int) {
        stopNsdDiscovery()
      }

      override fun onDiscoveryStarted(serviceType: String?) = Unit
      override fun onDiscoveryStopped(serviceType: String?) = Unit

      override fun onServiceFound(serviceInfo: NsdServiceInfo) {
        if (serviceInfo.serviceType != this@CrossBeamNativeModule.serviceType) return
        if (serviceInfo.serviceName == localServiceName) return
        nsdManager.resolveService(serviceInfo, object : NsdManager.ResolveListener {
          override fun onResolveFailed(serviceInfo: NsdServiceInfo?, errorCode: Int) = Unit

          override fun onServiceResolved(resolved: NsdServiceInfo) {
            val host: InetAddress? = resolved.host
            val attributes =
              if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) resolved.attributes else emptyMap()
            val advertisedPlatform = attributes["platform"]?.toString(Charsets.UTF_8)
            val advertisedName = attributes["deviceName"]?.toString(Charsets.UTF_8)
            val advertisedKey = attributes["deviceKey"]?.toString(Charsets.UTF_8)
              ?: deviceKeyFromServiceName(resolved.serviceName)
              ?: resolved.serviceName
            val displayName = bestPeerName(
              advertisedName,
              resolved.serviceName.takeUnless { it.startsWith("CrossBeam-") }
            )
            val peer = mapOf(
              "id" to canonicalPeerId(advertisedKey),
              "deviceKey" to advertisedKey,
              "name" to displayName,
              "platform" to (advertisedPlatform ?: inferPeerPlatform(displayName)),
              "connection" to "local-network",
              "host" to host?.hostAddress,
              "port" to resolved.port,
              "availability" to if (host != null && resolved.port > 0) "ready" else "unavailable",
              "isTransferReady" to (host != null && resolved.port > 0),
              "statusMessage" to if (host != null && resolved.port > 0) "Ready on local network" else "Could not resolve network endpoint",
              "isTrusted" to false,
              "lastSeenAt" to System.currentTimeMillis()
            )
            upsertPeer(peer)
          }
        })
      }

      override fun onServiceLost(serviceInfo: NsdServiceInfo) {
        val deviceKey = deviceKeyFromServiceName(serviceInfo.serviceName)
        val lostId = if (deviceKey != null) {
          canonicalPeerId(deviceKey)
        } else {
          peers.entries.firstOrNull { it.value["name"] == serviceInfo.serviceName }?.key
        }
        if (lostId != null) {
          val peer = peers[lostId]
          val routes = peer?.let { peerConnections(it) } ?: emptySet()
          val fallbackConnection = when {
            peer?.get("wifiDirectAddress") != null && routes.contains("wifi-direct") -> "wifi-direct"
            routes.contains("ble") -> "ble"
            else -> null
          }
          if (peer != null && fallbackConnection != null) {
            val downgraded = peer.toMutableMap().apply {
              remove("host")
              remove("port")
              put("connection", fallbackConnection)
              put("availableConnections", routes - "local-network")
              put("availability", "discovered")
              put("isTransferReady", false)
              put(
                "statusMessage",
                if (fallbackConnection == "wifi-direct")
                  "Local network route was lost; tap Connect for Wi-Fi Direct"
                else
                  "Local network route was lost; nearby over Bluetooth"
              )
              put("lastSeenAt", System.currentTimeMillis())
            }
            peers[lostId] = downgraded
            sendEvent("onPeerFound", downgraded)
          } else if (peers.remove(lostId) != null) {
            sendEvent("onPeerLost", mapOf("id" to lostId))
          }
        }
      }
    }

    discoveryListener = listener
    nsdManager.discoverServices(serviceType, NsdManager.PROTOCOL_DNS_SD, listener)
  }

  private fun stopNsdDiscovery() {
    val context = appContext.reactContext ?: return
    val listener = discoveryListener ?: return
    val nsdManager = context.getSystemService(Context.NSD_SERVICE) as? NsdManager ?: return
    try {
      nsdManager.stopServiceDiscovery(listener)
    } catch (_: IllegalArgumentException) {
      // Android throws when discovery already stopped; the desired state is still stopped.
    } finally {
      discoveryListener = null
      val lostIds = peers.entries
        .filter { (_, peer) -> peer["connection"] == "local-network" || peer.containsKey("host") }
        .map { it.key }
      lostIds.forEach { id ->
        peers.remove(id)
        sendEvent("onPeerLost", mapOf("id" to id))
      }
      releaseMulticastLock()
    }
  }

  private fun sendFilesToPeer(
    transferId: String,
    host: String,
    port: Int,
    peerId: String,
    files: List<Map<String, Any?>>
  ) {
    val context = appContext.reactContext ?: return
    
    // Start Foreground Service
    val serviceIntent = Intent(context, CrossBeamTransferService::class.java)
    runCatching {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent)
        } else {
            context.startService(serviceIntent)
        }
    }.onFailure { Log.e("CrossBeamNative", "Failed to start foreground service", it) }
    activeTransferCount.incrementAndGet()

    thread(name = "CrossBeamOutgoingTransfer", isDaemon = true) {
      var totalBytes = 0L
      var transferred = 0L
      try {
        if (files.isEmpty() || files.size > maxFileCount) {
          throw IllegalArgumentException("A transfer must contain between 1 and $maxFileCount files")
        }
        val outgoingFiles = files.map { file ->
          val name = sanitizeFileName(file["name"] as? String ?: "received-file")
          val uri = Uri.parse(file["uri"] as? String ?: throw IllegalArgumentException("Missing file URI"))
          val mimeType = (file["mimeType"] as? String)
            ?.takeIf {
              it.length <= 255 &&
                Regex("^[A-Za-z0-9!#$&^_.+-]+/[A-Za-z0-9!#$&^_.+-]+$").matches(it)
            }
            ?: "application/octet-stream"
          val (checksum, actualSize) = calculateSha256AndSize(context, uri)
          validateOutgoingFile(name, mimeType, actualSize)
          OutgoingFileHeader(name, uri, mimeType, actualSize, checksum)
        }
        totalBytes = outgoingFiles.fold(0L) { total, file ->
          Math.addExact(total, file.size).also {
            if (it > maxBatchSize) throw IllegalArgumentException("Transfer batch is too large")
          }
        }

        Socket().use { socket ->
          socket.connect(InetSocketAddress(host, port), socketConnectTimeoutMs)
          socket.soTimeout = socketReadTimeoutMs
          socket.tcpNoDelay = true
          activeSockets[transferId] = socket
          DataOutputStream(BufferedOutputStream(socket.getOutputStream())).use { output ->
            DataInputStream(BufferedInputStream(socket.getInputStream())).use { socketInput ->
              output.writeUTF(protocolMagic)
              output.writeInt(chunkedProtocolVersion)
              output.writeUTF(transferId)
              output.writeInt(outgoingFiles.size)

              outgoingFiles.forEach { file ->
                output.writeUTF(file.name)
                output.writeUTF(file.mimeType)
                output.writeLong(file.size)
                output.writeUTF(file.checksum)
              }
              output.flush()

              val accepted = socketInput.readBoolean()
              val approvalMessage = socketInput.readUTF()
              if (!accepted) {
                throw TransferRejectedException(
                  approvalMessage.ifBlank { "Transfer rejected by receiver" }
                )
              }

              outgoingFiles.forEach { file ->
                val name = file.name
                
                val requestedOffset = socketInput.readLong()
                 
                if (requestedOffset < 0L || requestedOffset > file.size) {
                    throw IllegalStateException("Receiver returned an invalid checkpoint for $name")
                }

                if (requestedOffset >= file.size) {
                    transferred += file.size
                } else {
                  context.contentResolver.openInputStream(file.uri)?.use { rawInput ->
                    if (requestedOffset > 0) {
                      var remainingToSkip = requestedOffset
                      while (remainingToSkip > 0) {
                          val skipped = rawInput.skip(remainingToSkip)
                          if (skipped <= 0L) {
                            if (rawInput.read() == -1) break
                            remainingToSkip -= 1
                            continue
                          }
                          remainingToSkip -= skipped
                      }
                      if (remainingToSkip != 0L) {
                        throw IllegalStateException("Unable to seek source file to resume checkpoint")
                      }
                      transferred += requestedOffset
                    }

                    BufferedInputStream(rawInput).use { input ->
                      val buffer = ByteArray(transferChunkSize)
                      var fileOffset = requestedOffset
                      var read = input.read(buffer)
                      while (read > 0) {
                      if (cancelledTransfers.contains(transferId)) {
                        throw TransferCancelledException()
                      }
                      
                      while (pausedTransfers.contains(transferId)) {
                        Thread.sleep(500)
                        if (cancelledTransfers.contains(transferId)) throw TransferCancelledException()
                      }

                      val chunkOffset = fileOffset
                      val chunkChecksum = sha256(buffer, read)

                      output.writeLong(chunkOffset)
                      output.writeInt(read)
                      output.writeUTF(chunkChecksum)
                      output.write(buffer, 0, read)
                      output.flush()

                      val ack = socketInput.readBoolean()
                      val nextOffset = socketInput.readLong()
                      if (!ack) {
                        throw IllegalStateException("Receiver rejected chunk at offset $chunkOffset for $name")
                      }
                      if (nextOffset != chunkOffset + read) {
                        throw IllegalStateException("Receiver returned an invalid checkpoint for $name")
                      }

                      transferred += read
                      fileOffset += read
                      
                      // Throttle notification updates somewhat (e.g. updating UI progress)
                      if (transferred % (DEFAULT_BUFFER_SIZE * 50) == 0L || transferred == totalBytes) {
                          val percent = (transferred * 100 / max(totalBytes, 1L)).toInt().coerceIn(0, 100)
                          CrossBeamTransferService.updateNotification(
                              context,
                              "Sending to $peerId",
                              "Progress: $percent%",
                              percent,
                              100
                          )
                      }

                      emitTransfer(
                        transferId,
                        peerId,
                        name,
                        transferred,
                        totalBytes,
                        "in-progress",
                        null,
                        file.mimeType
                      )
                        read = input.read(buffer)
                      }
                      if (fileOffset != file.size) {
                        throw IllegalStateException("Source file size changed while sending $name")
                      }
                    }
                  } ?: throw IllegalArgumentException("Unable to open file: $name")
                }

                val fileCommitted = socketInput.readBoolean()
                val commitMessage = socketInput.readUTF()
                if (!fileCommitted) {
                  throw IllegalStateException(
                    commitMessage.ifBlank { "Receiver could not commit $name" }
                  )
                }
                emitTransfer(
                  transferId,
                  peerId,
                  name,
                  transferred,
                  totalBytes,
                  "in-progress",
                  null,
                  file.mimeType,
                  null,
                  file.checksum,
                  true
                )
                output.flush()
              }

              val batchCommitted = socketInput.readBoolean()
              val batchMessage = socketInput.readUTF()
              if (!batchCommitted) {
                throw IllegalStateException(
                  batchMessage.ifBlank { "Receiver did not commit the transfer" }
                )
              }
            }
          }
        }

        if (cancelledTransfers.remove(transferId)) {
          emitTransfer(transferId, peerId, null, transferred, max(totalBytes, 1L), "cancelled", null)
        } else {
          emitTransfer(transferId, peerId, null, totalBytes, totalBytes, "completed", null)
        }
        activeSockets.remove(transferId)
      } catch (_: TransferCancelledException) {
        activeSockets.remove(transferId)
        cancelledTransfers.remove(transferId)
        emitTransfer(transferId, peerId, null, transferred, max(totalBytes, 1L), "cancelled", null)
      } catch (error: TransferRejectedException) {
        activeSockets.remove(transferId)
        emitTransfer(transferId, peerId, null, transferred, max(totalBytes, 1L), "rejected", error.message)
      } catch (error: Exception) {
        activeSockets.remove(transferId)
        if (cancelledTransfers.remove(transferId)) {
          emitTransfer(transferId, peerId, null, transferred, max(totalBytes, 1L), "cancelled", null)
        } else {
          emitTransfer(transferId, peerId, null, transferred, max(totalBytes, 1L), "failed", error.message)
        }
      } finally {
          pausedTransfers.remove(transferId)
          if (activeTransferCount.decrementAndGet() <= 0) {
              context.stopService(serviceIntent)
          }
      }
    }
  }

  private fun getStructuredOutputDir(downloadsRoot: File, mimeType: String): File {
    return File(downloadsRoot, "CrossBeam/${getMimeSubfolder(mimeType)}")
  }

  private fun getMimeSubfolder(mimeType: String): String = when {
      mimeType.startsWith("image/") -> "Images"
      mimeType.startsWith("video/") -> "Videos"
      mimeType.startsWith("audio/") -> "Audio"
      mimeType == "application/pdf" || mimeType.startsWith("text/") || 
        mimeType.contains("word") || mimeType.contains("excel") || mimeType.contains("powerpoint") -> "Documents"
      else -> "Others"
  }

  private fun checkStorageSpace(context: Context, totalSize: Long) {
    val statFs = android.os.StatFs(context.filesDir.absolutePath)
    val availableBytes = statFs.availableBlocksLong * statFs.blockSizeLong
    val requiredBytes = try {
      Math.addExact(Math.multiplyExact(totalSize, 2L), 100L * 1024L * 1024L)
    } catch (_: ArithmeticException) {
      Long.MAX_VALUE
    }
    
    if (availableBytes < requiredBytes) {
      throw IllegalStateException("Insufficient storage for a safe, atomic receive")
    }
  }

  private fun validateOutgoingFile(name: String, mimeType: String, size: Long) {
    if (name.length > 255) throw IllegalArgumentException("File name is too long")
    if (mimeType.length > 255) throw IllegalArgumentException("MIME type is too long")
    if (!Regex("^[A-Za-z0-9!#$&^_.+-]+/[A-Za-z0-9!#$&^_.+-]+$").matches(mimeType)) {
      throw IllegalArgumentException("Invalid MIME type")
    }
    if (size < 0L || size > maxFileSize) throw IllegalArgumentException("File size is not supported")
  }

  private fun validateIncomingHeader(header: IncomingFileHeader) {
    validateOutgoingFile(header.name, header.mimeType, header.size)
    if (!Regex("^[0-9a-f]{64}$").matches(header.checksum)) {
      throw IllegalArgumentException("Invalid file checksum")
    }
  }

  private fun partialFileFor(context: Context, header: IncomingFileHeader): File {
    val directory = File(context.filesDir, "crossbeam-partials")
    if (!directory.exists() && !directory.mkdirs()) {
      throw IllegalStateException("Could not create partial transfer directory")
    }
    return File(directory, "${header.checksum.take(24)}-${sanitizeFileName(header.name).take(180)}.crossbeam-part")
  }

  private fun uniqueMediaStoreName(context: Context, relativePath: String, fileName: String): String {
    val resolver = context.contentResolver
    val collection = MediaStore.Downloads.EXTERNAL_CONTENT_URI
    val dot = fileName.lastIndexOf('.')
    val base = if (dot > 0) fileName.substring(0, dot) else fileName
    val extension = if (dot > 0) fileName.substring(dot) else ""
    var candidate = fileName
    var index = 1
    while (true) {
      resolver.query(
        collection,
        arrayOf(MediaStore.MediaColumns._ID),
        "${MediaStore.MediaColumns.DISPLAY_NAME}=? AND ${MediaStore.MediaColumns.RELATIVE_PATH}=?",
        arrayOf(candidate, relativePath),
        null
      )?.use { cursor ->
        if (!cursor.moveToFirst()) return candidate
      } ?: return candidate
      candidate = "$base ($index)$extension"
      index += 1
    }
  }

  private fun publishReceivedFile(
    context: Context,
    partial: File,
    header: IncomingFileHeader
  ): String {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      val relativePath = "${Environment.DIRECTORY_DOWNLOADS}/CrossBeam/${getMimeSubfolder(header.mimeType)}/"
      val displayName = uniqueMediaStoreName(context, relativePath, header.name)
      val values = ContentValues().apply {
        put(MediaStore.MediaColumns.DISPLAY_NAME, displayName)
        put(MediaStore.MediaColumns.MIME_TYPE, header.mimeType)
        put(MediaStore.MediaColumns.RELATIVE_PATH, relativePath)
        put(MediaStore.MediaColumns.IS_PENDING, 1)
      }
      val resolver = context.contentResolver
      val destination = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
        ?: throw IllegalStateException("Could not create the destination file")
      try {
        resolver.openOutputStream(destination, "w")?.use { output ->
          partial.inputStream().use { input -> input.copyTo(output, DEFAULT_BUFFER_SIZE) }
        } ?: throw IllegalStateException("Could not open the destination file")
        values.clear()
        values.put(MediaStore.MediaColumns.IS_PENDING, 0)
        if (resolver.update(destination, values, null, null) <= 0) {
          throw IllegalStateException("Could not publish the received file")
        }
        if (!partial.delete()) partial.deleteOnExit()
        return destination.toString()
      } catch (error: Exception) {
        resolver.delete(destination, null, null)
        throw error
      }
    }

    val downloadsRoot = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
    val outputDir = getStructuredOutputDir(downloadsRoot, header.mimeType)
    if (!outputDir.exists() && !outputDir.mkdirs()) {
      throw IllegalStateException("Could not create storage directory")
    }
    val destination = uniqueDestination(outputDir, header.name)
    FileOutputStream(destination).use { output ->
      partial.inputStream().use { input -> input.copyTo(output, DEFAULT_BUFFER_SIZE) }
      output.fd.sync()
    }
    if (!partial.delete()) partial.deleteOnExit()
    MediaScannerConnection.scanFile(context, arrayOf(destination.absolutePath), arrayOf(header.mimeType), null)
    return destination.absolutePath
  }

  private fun receiveFilesFromPeer(socket: Socket) {
    val context = appContext.reactContext ?: run {
      socket.close()
      return
    }
    val peerId = socket.inetAddress.hostAddress ?: "unknown-peer"
    var currentTransferId: String? = null
    var batchTotal = 1L
    var batchTransferred = 0L
    
    val serviceIntent = Intent(context, CrossBeamTransferService::class.java)
    runCatching {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(serviceIntent)
      } else {
        context.startService(serviceIntent)
      }
    }.onFailure { Log.e("CrossBeamNative", "Failed to start foreground service", it) }
    activeTransferCount.incrementAndGet()

    socket.use transfer@ { client ->
      try {
        client.soTimeout = socketReadTimeoutMs
        client.tcpNoDelay = true
        DataInputStream(BufferedInputStream(client.getInputStream())).use { input ->
          DataOutputStream(BufferedOutputStream(client.getOutputStream())).use { output ->
            if (input.readUTF() != protocolMagic) throw IllegalArgumentException("Unsupported CrossBeam protocol")
            if (input.readInt() != chunkedProtocolVersion) throw IllegalArgumentException("Unsupported protocol version")

            val transferId = input.readUTF()
            if (transferId.isBlank() || transferId.length > 128) {
              throw IllegalArgumentException("Invalid transfer ID")
            }
            currentTransferId = transferId
            activeSockets[transferId] = client
            val fileCount = input.readInt()
            if (fileCount !in 1..maxFileCount) {
              throw IllegalArgumentException("Invalid file count")
            }
            
            val pendingFiles = mutableListOf<IncomingFileHeader>()
            batchTotal = 0L
            repeat(fileCount) {
              val header = IncomingFileHeader(sanitizeFileName(input.readUTF()), input.readUTF(), input.readLong(), input.readUTF())
              validateIncomingHeader(header)
              batchTotal = Math.addExact(batchTotal, header.size)
              if (batchTotal > maxBatchSize) throw IllegalArgumentException("Transfer batch is too large")
              pendingFiles.add(header)
            }

            checkStorageSpace(context, batchTotal)

            emitIncomingTransferRequest(
              transferId,
              peerId,
              pendingFiles.map { it.name },
              batchTotal
            )
            val accepted = waitForIncomingApproval(transferId)
            output.writeBoolean(accepted)
            output.writeUTF(if (accepted) "" else "Transfer rejected by receiver")
            output.flush()
            if (!accepted) {
              emitTransfer(
                transferId,
                peerId,
                pendingFiles.firstOrNull()?.name,
                0,
                batchTotal,
                "rejected",
                "Transfer rejected by receiver"
              )
              return@transfer
            }

            batchTransferred = 0L
            pendingFiles.forEach { header ->
              val partial = partialFileFor(context, header)
              val offset = if (partial.exists() && partial.isFile && partial.length() <= header.size) partial.length() else 0L
              if (offset == 0L && partial.exists()) partial.delete()

              output.writeLong(offset)
              output.flush()
              batchTransferred += offset

              if (offset < header.size) {
                RandomAccessFile(partial, "rw").use { fileOutput ->
                  fileOutput.seek(offset)
                  var remaining = header.size - offset
                  while (remaining > 0) {
                    if (cancelledTransfers.contains(transferId)) throw TransferCancelledException()
                    while (pausedTransfers.contains(transferId)) {
                      Thread.sleep(250)
                      if (cancelledTransfers.contains(transferId)) throw TransferCancelledException()
                    }

                    val chunkOffset = input.readLong()
                    val chunkLength = input.readInt()
                    val chunkChecksum = input.readUTF()
                    
                    if (chunkOffset != fileOutput.filePointer) throw IllegalStateException("Unexpected chunk offset")
                    if (
                      chunkLength <= 0 ||
                      chunkLength > transferChunkSize ||
                      chunkLength.toLong() > remaining
                    ) {
                      throw IllegalArgumentException("Invalid chunk length")
                    }
                    if (!Regex("^[0-9a-f]{64}$").matches(chunkChecksum)) {
                      throw IllegalArgumentException("Invalid chunk checksum")
                    }
                    
                    val chunk = ByteArray(chunkLength)
                    input.readFully(chunk)
                    if (sha256(chunk, chunkLength) != chunkChecksum) throw IllegalStateException("Chunk checksum mismatch")

                    fileOutput.write(chunk)
                    fileOutput.fd.sync()
                    remaining -= chunkLength
                    batchTransferred += chunkLength
                    output.writeBoolean(true)
                    output.writeLong(fileOutput.filePointer)
                    output.flush()
                    
                    if (batchTransferred % (DEFAULT_BUFFER_SIZE * 50) == 0L || batchTransferred == batchTotal) {
                      val percent = (batchTransferred * 100 / max(batchTotal, 1L)).toInt().coerceIn(0, 100)
                      CrossBeamTransferService.updateNotification(context, "Receiving from $peerId", "Progress: $percent%", percent, 100)
                    }
                    emitTransfer(transferId, peerId, header.name, batchTransferred, batchTotal, "in-progress", null, header.mimeType)
                  }
                }
              }

              if (!partial.exists()) partial.createNewFile()
              if (partial.length() != header.size) {
                throw IllegalStateException("Received file size mismatch")
              }
              if (header.checksum != calculateSha256(partial)) {
                partial.delete()
                throw IllegalStateException("Checksum mismatch")
              }
              val savedUri = try {
                publishReceivedFile(context, partial, header)
              } catch (error: Exception) {
                output.writeBoolean(false)
                output.writeUTF((error.message ?: "Could not save received file").take(512))
                output.flush()
                throw error
              }
              output.writeBoolean(true)
              output.writeUTF("")
              output.flush()
              emitTransfer(
                transferId,
                peerId,
                header.name,
                batchTransferred,
                batchTotal,
                "in-progress",
                null,
                header.mimeType,
                savedUri,
                header.checksum,
                true
              )
            }
            output.writeBoolean(true)
            output.writeUTF("")
            output.flush()
            emitTransfer(transferId, peerId, null, batchTotal, batchTotal, "completed", null)
          }
        }
      } catch (_: TransferCancelledException) {
        val transferId = currentTransferId ?: "unknown-transfer"
        cancelledTransfers.remove(transferId)
        emitTransfer(transferId, peerId, null, batchTransferred, max(batchTotal, 1L), "cancelled", null)
      } catch (error: Exception) {
        val transferId = currentTransferId ?: "unidentified-${UUID.randomUUID()}"
        if (cancelledTransfers.remove(transferId)) {
          emitTransfer(transferId, peerId, null, batchTransferred, max(batchTotal, 1L), "cancelled", null)
        } else {
          emitTransfer(transferId, peerId, null, batchTransferred, max(batchTotal, 1L), "failed", error.message)
        }
      } finally {
        currentTransferId?.let {
          activeSockets.remove(it)
          pausedTransfers.remove(it)
          pendingIncomingApprovals.remove(it)?.countDown()
          incomingApprovalResults.remove(it)
        }
        if (activeTransferCount.decrementAndGet() <= 0) context.stopService(serviceIntent)
      }
    }
  }

  private fun startBleDiscovery() {
    val context = appContext() ?: return
    if (!hasBluetoothScanPermission(context) || !hasBluetoothConnectPermission(context)) return
    val bluetoothManager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
    bluetoothAdapter = bluetoothManager?.adapter

    if (bluetoothAdapter == null || bluetoothAdapter?.isEnabled == false) return

    val deviceKey = getOrCreateDeviceKey(context)
    val friendlyName = getFriendlyDeviceName(context)

    bleAdvertiser = if (hasBluetoothAdvertisePermission(context)) {
      bluetoothAdapter?.bluetoothLeAdvertiser
    } else {
      null
    }
    bleScanner = bluetoothAdapter?.bluetoothLeScanner

    // --- Start Advertising ---
    val settings = AdvertiseSettings.Builder()
      .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_BALANCED)
      .setConnectable(true)
      .setTimeout(0)
      .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_MEDIUM)
      .build()

    val data = AdvertiseData.Builder()
      .setIncludeDeviceName(false)
      .addServiceUuid(ParcelUuid(bleServiceUuid))
      .addServiceData(ParcelUuid(bleServiceUuid), deviceKey.toByteArray(Charsets.UTF_8))
      .build()

    val scanResponse = AdvertiseData.Builder()
      .setIncludeDeviceName(true)
      .build()

    bleAdvertiseCallback = object : AdvertiseCallback() {
      override fun onStartSuccess(settingsInEffect: AdvertiseSettings?) = Unit
      override fun onStartFailure(errorCode: Int) {
        bleAdvertiseCallback = null
      }
    }

    if (hasBluetoothAdvertisePermission(context)) {
      bleAdvertiser?.startAdvertising(settings, data, scanResponse, bleAdvertiseCallback)
    }

    // --- Start Scanning ---
    val filter = ScanFilter.Builder()
      .setServiceUuid(ParcelUuid(bleServiceUuid))
      .build()

    bleScanCallback = object : ScanCallback() {
      override fun onScanResult(callbackType: Int, result: ScanResult) {
        val deviceKey = parseBleDeviceKey(result) ?: result.device.address
        val name = parseBleDeviceName(result) ?: "Nearby Device"

        val peer = mapOf(
          "id" to canonicalPeerId(deviceKey),
          "deviceKey" to deviceKey,
          "name" to name,
          "platform" to inferPeerPlatform(name),
          "connection" to "ble",
          "availability" to "discovered",
          "isTransferReady" to false,
          "statusMessage" to "Discovered over Bluetooth; waiting for a network endpoint",
          "isTrusted" to false,
          "lastSeenAt" to System.currentTimeMillis()
        )
        upsertPeer(peer)
      }

      override fun onScanFailed(errorCode: Int) {
        bleScanCallback = null
      }
    }

    bleScanner?.startScan(listOf(filter), android.bluetooth.le.ScanSettings.Builder().build(), bleScanCallback)
  }

  private fun stopBleDiscovery() {
    val context = appContext()
    try {
      if (context == null || hasBluetoothAdvertisePermission(context)) {
        bleAdvertiser?.stopAdvertising(bleAdvertiseCallback)
      }
      if (context == null || hasBluetoothScanPermission(context)) {
        bleScanner?.stopScan(bleScanCallback)
      }
    } catch (_: Exception) {}
    bleAdvertiseCallback = null
    bleScanCallback = null
    peers.entries.removeIf { (_, peer) ->
      peer["connection"] == "ble" && !hasTransferEndpoint(peer)
    }
  }

  private fun calculateSha256AndSize(context: Context, uri: Uri): Pair<String, Long> {
    val digest = MessageDigest.getInstance("SHA-256")
    var totalBytes = 0L
    context.contentResolver.openInputStream(uri)?.use { rawInput ->
      BufferedInputStream(rawInput).use { input ->
        val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
        var read = input.read(buffer)
        while (read > 0) {
          digest.update(buffer, 0, read)
          totalBytes = Math.addExact(totalBytes, read.toLong())
          if (totalBytes > maxFileSize) throw IllegalArgumentException("File size is not supported")
          read = input.read(buffer)
        }
      }
    } ?: throw IllegalArgumentException("Unable to read file for checksum")
    return digest.digest().joinToString("") { "%02x".format(it) } to totalBytes
  }

  private fun calculateSha256(file: File): String {
    val digest = MessageDigest.getInstance("SHA-256")
    BufferedInputStream(file.inputStream()).use { input ->
      val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
      var read = input.read(buffer)
      while (read >= 0) {
        digest.update(buffer, 0, read)
        read = input.read(buffer)
      }
    }
    return digest.digest().joinToString("") { "%02x".format(it) }
  }

  private fun sha256(bytes: ByteArray, length: Int): String {
    val digest = MessageDigest.getInstance("SHA-256")
    digest.update(bytes, 0, length)
    return digest.digest().joinToString("") { "%02x".format(it) }
  }

  private fun emitTransfer(
    transferId: String,
    peerId: String,
    fileName: String?,
    bytesTransferred: Long,
    totalBytes: Long,
    status: String,
    errorMessage: String?,
    mimeType: String? = null,
    savedFilePath: String? = null,
    checksum: String? = null,
    integrityVerified: Boolean? = null
  ) {
    sendEvent(
      "onTransferProgress",
      mapOf(
        "transferId" to transferId,
        "peerId" to peerId,
        "fileName" to fileName,
        "mimeType" to mimeType,
        "bytesTransferred" to bytesTransferred,
        "totalBytes" to totalBytes,
        "status" to status,
        "errorMessage" to errorMessage,
        "savedFilePath" to savedFilePath,
        "checksum" to checksum,
        "integrityVerified" to integrityVerified
      )
    )
  }

  private fun sanitizeFileName(name: String): String {
    val cleaned = name
      .replace(Regex("[\\\\/:*?\"<>|\\p{Cntrl}]"), "_")
      .trim()
      .trim('.')
    return cleaned.ifBlank { "received-file" }
  }

  private fun uniqueDestination(directory: File, fileName: String): File {
    val safeName = sanitizeFileName(fileName)
    var destination = File(directory, safeName)
    if (!destination.exists()) return destination

    val dot = safeName.lastIndexOf('.')
    val base = if (dot > 0) safeName.substring(0, dot) else safeName
    val ext = if (dot > 0) safeName.substring(dot) else ""
    var index = 1
    while (destination.exists()) {
      destination = File(directory, "$base ($index)$ext")
      index += 1
    }
    return destination
  }

  private data class IncomingFileHeader(
    val name: String,
    val mimeType: String,
    val size: Long,
    val checksum: String
  )

  private data class OutgoingFileHeader(
    val name: String,
    val uri: Uri,
    val mimeType: String,
    val size: Long,
    val checksum: String
  )

  private class TransferCancelledException : Exception()
  private class TransferRejectedException(message: String) : Exception(message)
}
