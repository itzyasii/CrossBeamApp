package com.crossbeam.nativebridge

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
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
import java.io.RandomAccessFile
import java.net.InetAddress
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
  private val chunkedProtocolVersion = 2
  private val transferChunkSize = 1024 * 1024
  private val DEFAULT_BUFFER_SIZE = 8192

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

  private fun mergePeerMaps(a: Map<String, Any?>, b: Map<String, Any?>): Map<String, Any?> {
    val transferPeer = when {
      hasTransferEndpoint(b) -> b
      hasTransferEndpoint(a) -> a
      else -> a
    }
    val other = if (transferPeer == b) a else b
    val deviceKey = (transferPeer["deviceKey"] as? String)
      ?: (other["deviceKey"] as? String)
      ?: transferPeer["id"] as String

    return mapOf(
      "id" to canonicalPeerId(deviceKey),
      "deviceKey" to deviceKey,
      "name" to bestPeerName(transferPeer["name"] as? String, other["name"] as? String),
      "platform" to (transferPeer["platform"] ?: other["platform"] ?: "android"),
      "connection" to if (hasTransferEndpoint(transferPeer)) "local-network" else (transferPeer["connection"] ?: "ble"),
      "host" to transferPeer["host"],
      "port" to transferPeer["port"],
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
    val deviceKey = incoming["deviceKey"] as? String ?: incoming["id"] as String
    val normalized = incoming.toMutableMap().apply {
      put("deviceKey", deviceKey)
      put("id", canonicalPeerId(deviceKey))
    }

    val existing = findPeerByDeviceKey(deviceKey)
      ?: peers[normalized["id"] as String]
      ?: peers[incoming["id"] as String]

    val merged = if (existing != null) mergePeerMaps(normalized, existing) else normalized
    removePeersExcept(merged["id"] as String, deviceKey)
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
      INSTANCE = this
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
        "protocol" to "crossbeam-chunk-v2",
        "version" to chunkedProtocolVersion,
        "chunkSizeBytes" to transferChunkSize,
        "supportsChunkAck" to true,
        "supportsPause" to true,
        "supportsResume" to true,
        "supportsRetry" to true
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

      val acceptIntent = Intent("com.crossbeam.ACTION_INCOMING_TRANSFER").apply {
        putExtra("transferId", transferId)
        putExtra("action", "accept")
      }
      val rejectIntent = Intent("com.crossbeam.ACTION_INCOMING_TRANSFER").apply {
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
      val peer = resolvePeer(peerId)
        ?: throw IllegalArgumentException("Peer is not available")
      val host = peer["host"] as? String
        ?: throw IllegalArgumentException("Peer host is unavailable")
      val port = (peer["port"] as? Number)?.toInt()
        ?: throw IllegalArgumentException("Peer port is unavailable")
      val transferId = UUID.randomUUID().toString()
      val resolvedPeerId = peer["id"] as String
      sendFilesToPeer(transferId, host, port, resolvedPeerId, files)
      mapOf("transferId" to transferId)
    }

    AsyncFunction("cancelTransfer") { transferId: String ->
      cancelledTransfers.add(transferId)
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
          WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION -> {
            if (!hasNearbyWifiPermission(context)) return
            wifiP2pManager?.requestPeers(wifiP2pChannel) { peersList ->
              val peerMapList = peersList.deviceList.map { device ->
                mapOf(
                  "id" to device.deviceAddress,
                  "name" to device.deviceName,
                  "status" to when (device.status) {
                    WifiP2pDevice.AVAILABLE -> "available"
                    WifiP2pDevice.INVITED -> "invited"
                    WifiP2pDevice.CONNECTED -> "connected"
                    WifiP2pDevice.FAILED -> "failed"
                    WifiP2pDevice.UNAVAILABLE -> "unavailable"
                    else -> "unknown"
                  }
                )
              }
              sendEvent("onWiFiDirectPeersChanged", mapOf("peers" to peerMapList))
            }
          }
          WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION -> {
            // Handle connection change
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
  private fun startTransferServer() {
    if (serverSocket != null) return
    val socket = ServerSocket(0)
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
        if (lostId != null && peers.remove(lostId) != null) {
          sendEvent("onPeerLost", mapOf("id" to lostId))
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
      val totalBytes = files.sumOf { (it["sizeBytes"] as? Number)?.toLong() ?: 0L }
      var transferred = 0L
      try {
        val outgoingFiles = files.map { file ->
          val name = sanitizeFileName(file["name"] as? String ?: "received-file")
          val uri = Uri.parse(file["uri"] as? String ?: throw IllegalArgumentException("Missing file URI"))
          val size = (file["sizeBytes"] as? Number)?.toLong() ?: 0L
          val mimeType = file["mimeType"] as? String ?: "application/octet-stream"
          val checksum = calculateSha256(context, uri)
          OutgoingFileHeader(name, uri, mimeType, size, checksum)
        }

        Socket(host, port).use { socket ->
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

              outgoingFiles.forEach { file ->
                val name = file.name
                
                val requestedOffset = socketInput.readLong()
                 
                if (requestedOffset >= file.size) {
                    transferred += file.size
                    return@forEach
                }

                context.contentResolver.openInputStream(file.uri)?.use { rawInput ->
                  if (requestedOffset > 0) {
                      var remainingToSkip = requestedOffset
                      while (remainingToSkip > 0) {
                          val skipped = rawInput.skip(remainingToSkip)
                          if (skipped <= 0L) break
                          remainingToSkip -= skipped
                      }
                      transferred += requestedOffset
                  }

                  BufferedInputStream(rawInput).use { input ->
                    val buffer = ByteArray(transferChunkSize)
                    var fileOffset = requestedOffset
                    var read = input.read(buffer)
                    while (read >= 0) {
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
                      if (nextOffset < chunkOffset + read) {
                        throw IllegalStateException("Receiver checkpoint did not advance for $name")
                      }

                      transferred += read
                      fileOffset += read
                      
                      // Throttle notification updates somewhat (e.g. updating UI progress)
                      if (transferred % (DEFAULT_BUFFER_SIZE * 50) == 0L || transferred == totalBytes) {
                          CrossBeamTransferService.updateNotification(
                              context,
                              "Sending to $peerId",
                              "Progress: ${(transferred * 100 / max(totalBytes, 1L))}%",
                              transferred.toInt(),
                              totalBytes.toInt()
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
                  }
                } ?: throw IllegalArgumentException("Unable to open file: $name")
                output.flush()
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
      } catch (error: Exception) {
        activeSockets.remove(transferId)
        emitTransfer(transferId, peerId, null, transferred, max(totalBytes, 1L), "failed", error.message)
      } finally {
          if (activeTransferCount.decrementAndGet() <= 0) {
              context.stopService(serviceIntent)
          }
      }
    }
  }

  private fun getStructuredOutputDir(downloadsRoot: File, mimeType: String): File {
    val subfolder = when {
      mimeType.startsWith("image/") -> "Images"
      mimeType.startsWith("video/") -> "Videos"
      mimeType.startsWith("audio/") -> "Audio"
      mimeType == "application/pdf" || mimeType.startsWith("text/") || 
        mimeType.contains("word") || mimeType.contains("excel") || mimeType.contains("powerpoint") -> "Documents"
      else -> "Others"
    }
    return File(downloadsRoot, "CrossBeam/$subfolder")
  }

  private fun checkStorageSpace(outputDir: File, totalSize: Long) {
    val statFs = android.os.StatFs(outputDir.absolutePath)
    val availableBytes = statFs.availableBlocksLong * statFs.blockSizeLong
    val requiredBytes = totalSize + (500L * 1024L * 1024L) // Safety buffer 500MB
    
    if (availableBytes < requiredBytes) {
      throw IllegalStateException("Insufficient storage on device. Need ${requiredBytes / (1024*1024)} MB.")
    }
  }

  private fun receiveFilesFromPeer(socket: Socket) {
    val context = appContext.reactContext ?: return
    val peerId = socket.inetAddress.hostAddress ?: "unknown-peer"
    
    val serviceIntent = Intent(context, CrossBeamTransferService::class.java)
    runCatching {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(serviceIntent)
      } else {
        context.startService(serviceIntent)
      }
    }.onFailure { Log.e("CrossBeamNative", "Failed to start foreground service", it) }
    activeTransferCount.incrementAndGet()

    socket.use { client ->
      try {
        DataInputStream(BufferedInputStream(client.getInputStream())).use { input ->
          DataOutputStream(BufferedOutputStream(client.getOutputStream())).use { output ->
            if (input.readUTF() != protocolMagic) throw IllegalArgumentException("Unsupported CrossBeam protocol")
            if (input.readInt() < chunkedProtocolVersion) throw IllegalArgumentException("Unsupported protocol version")

            val transferId = input.readUTF()
            val fileCount = input.readInt()
            val downloadsRoot = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
            
            val pendingFiles = mutableListOf<IncomingFileHeader>()
            var batchTotal = 0L
            repeat(fileCount) {
              val header = IncomingFileHeader(sanitizeFileName(input.readUTF()), input.readUTF(), input.readLong(), input.readUTF())
              batchTotal += header.size
              pendingFiles.add(header)
            }

            checkStorageSpace(downloadsRoot, batchTotal)

            emitIncomingTransferRequest(
              transferId,
              peerId,
              pendingFiles.map { it.name },
              batchTotal
            )
            if (!waitForIncomingApproval(transferId)) {
              emitTransfer(
                transferId,
                peerId,
                pendingFiles.firstOrNull()?.name,
                0,
                batchTotal,
                "rejected",
                "Transfer rejected by receiver"
              )
              return@use
            }

            var batchTransferred = 0L
            pendingFiles.forEach { header ->
              val outputDir = getStructuredOutputDir(downloadsRoot, header.mimeType)
              if (!outputDir.exists() && !outputDir.mkdirs()) throw IllegalStateException("Could not create storage directory")

              val destination = uniqueDestination(outputDir, header.name)
              val partial = File(outputDir, "${destination.name}.crossbeam-part")
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
                    val chunkOffset = input.readLong()
                    val chunkLength = input.readInt()
                    val chunkChecksum = input.readUTF()
                    
                    if (chunkOffset != fileOutput.filePointer) throw IllegalStateException("Unexpected chunk offset")
                    
                    val chunk = ByteArray(chunkLength)
                    input.readFully(chunk)
                    if (sha256(chunk, chunkLength) != chunkChecksum) throw IllegalStateException("Chunk checksum mismatch")

                    fileOutput.write(chunk)
                    remaining -= chunkLength
                    batchTransferred += chunkLength
                    output.writeBoolean(true)
                    output.writeLong(fileOutput.filePointer)
                    output.flush()
                    
                    if (batchTransferred % (DEFAULT_BUFFER_SIZE * 50) == 0L || batchTransferred == batchTotal) {
                      CrossBeamTransferService.updateNotification(context, "Receiving from $peerId", "Progress: ${(batchTransferred * 100 / max(batchTotal, 1L))}%", batchTransferred.toInt(), batchTotal.toInt())
                    }
                    emitTransfer(transferId, peerId, header.name, batchTransferred, batchTotal, "in-progress", null, header.mimeType)
                  }
                }
              }

              if (!partial.exists()) partial.createNewFile()
              if (header.checksum.isNotBlank() && header.checksum != calculateSha256(partial)) {
                partial.delete()
                throw IllegalStateException("Checksum mismatch")
              }
              if (destination.exists()) destination.delete()
              if (!partial.renameTo(destination)) throw IllegalStateException("Could not save received file")
              
              MediaScannerConnection.scanFile(context, arrayOf(destination.absolutePath), arrayOf(header.mimeType), null)
              emitTransfer(
                transferId,
                peerId,
                header.name,
                batchTransferred,
                batchTotal,
                "in-progress",
                null,
                header.mimeType,
                destination.absolutePath
              )
            }
            emitTransfer(transferId, peerId, null, batchTotal, batchTotal, "completed", null)
          }
        }
      } catch (error: Exception) {
        emitTransfer(UUID.randomUUID().toString(), peerId, null, 0, 1, "failed", error.message)
      } finally {
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

  private fun calculateSha256(context: Context, uri: Uri): String {
    val digest = MessageDigest.getInstance("SHA-256")
    context.contentResolver.openInputStream(uri)?.use { rawInput ->
      BufferedInputStream(rawInput).use { input ->
        val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
        var read = input.read(buffer)
        while (read >= 0) {
          digest.update(buffer, 0, read)
          read = input.read(buffer)
        }
      }
    } ?: throw IllegalArgumentException("Unable to read file for checksum")
    return digest.digest().joinToString("") { "%02x".format(it) }
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
    savedFilePath: String? = null
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
        "savedFilePath" to savedFilePath
      )
    )
  }

  private fun sanitizeFileName(name: String): String {
    val cleaned = name.replace(Regex("[\\\\/:*?\"<>|]"), "_").trim()
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
}