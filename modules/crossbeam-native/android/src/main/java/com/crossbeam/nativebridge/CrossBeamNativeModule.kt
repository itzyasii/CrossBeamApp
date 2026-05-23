package com.crossbeam.nativebridge

import android.content.Context
import android.net.Uri
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.os.Build
import android.os.Environment
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
import android.content.Intent
import android.content.res.Configuration
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import kotlin.concurrent.thread
import kotlin.math.max

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import android.util.Base64

import android.net.wifi.p2p.WifiP2pConfig
import android.net.wifi.p2p.WifiP2pDevice
import android.net.wifi.p2p.WifiP2pManager
import android.content.IntentFilter
import android.content.BroadcastReceiver

class CrossBeamNativeModule : Module() {
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
  private var serverSocket: ServerSocket? = null
  private var serverThread: Thread? = null
  private var localServiceName: String? = null
  private val activeSockets = ConcurrentHashMap<String, Socket>()
  private val cancelledTransfers = ConcurrentHashMap.newKeySet<String>()
  private val pausedTransfers = ConcurrentHashMap.newKeySet<String>()
  private val serviceType = "_crossbeam._tcp."
  private val protocolMagic = "CROSSBEAM1"
  private val chunkedProtocolVersion = 2
  private val transferChunkSize = 1024 * 1024

  // BLE State
  private var bluetoothAdapter: BluetoothAdapter? = null
  private var bleAdvertiser: BluetoothLeAdvertiser? = null
  private var bleScanner: BluetoothLeScanner? = null
  private val bleServiceUuid = UUID.fromString("63626561-6d2d-7032-702d-646973636f76") // "cbeam-p2p-discov"
  private var bleAdvertiseCallback: AdvertiseCallback? = null
  private var bleScanCallback: ScanCallback? = null

  override fun definition() = ModuleDefinition {
    Name("CrossBeamNative")

    Events(
      "onPeerFound",
      "onPeerLost",
      "onTransferProgress",
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

    AsyncFunction("startDiscovery") {
      initWifiP2p()
      startTransferServer()
      registerLocalService()
      startNsdDiscovery()
      startBleDiscovery()
      startWifiP2pDiscovery()
    }

    AsyncFunction("stopDiscovery") {
      stopWifiP2pDiscovery()
      stopNsdDiscovery()
      unregisterLocalService()
      stopTransferServer()
      stopBleDiscovery()
    }

    AsyncFunction("getDiscoveredPeers") {
      peers.values.toList()
    }

    AsyncFunction("sendFiles") { request: Map<String, Any?> ->
      val peerId = request["peerId"] as? String
        ?: throw IllegalArgumentException("Missing peerId")
      @Suppress("UNCHECKED_CAST")
      val files = request["files"] as? List<Map<String, Any?>>
        ?: throw IllegalArgumentException("Missing files")
      val peer = peers[peerId]
        ?: throw IllegalArgumentException("Peer is not available")
      val host = peer["host"] as? String
        ?: throw IllegalArgumentException("Peer host is unavailable")
      val port = (peer["port"] as? Number)?.toInt()
        ?: throw IllegalArgumentException("Peer port is unavailable")
      val transferId = UUID.randomUUID().toString()
      sendFilesToPeer(transferId, host, port, peerId, files)
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

  private fun initWifiP2p() {
    val context = appContext.reactContext ?: return
    if (wifiP2pManager != null) return

    wifiP2pManager = context.getSystemService(Context.WIFI_P2P_SERVICE) as? WifiP2pManager
    wifiP2pChannel = wifiP2pManager?.initialize(context, context.mainLooper, null)
    
    wifiP2pReceiver = object : BroadcastReceiver() {
      override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
          WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION -> {
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
              sendEvent("onWiFiDirectPeersChanged", peerMapList)
            }
          }
          WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION -> {
            // Handle connection change
          }
        }
      }
    }
    context.registerReceiver(wifiP2pReceiver, wifiP2pIntentFilter)
  }

  private fun startWifiP2pDiscovery() {
    wifiP2pManager?.discoverPeers(wifiP2pChannel, object : WifiP2pManager.ActionListener {
      override fun onSuccess() = Unit
      override fun onFailure(reason: Int) = Unit
    })
  }

  private fun stopWifiP2pDiscovery() {
    wifiP2pManager?.stopPeerDiscovery(wifiP2pChannel, object : WifiP2pManager.ActionListener {
      override fun onSuccess() = Unit
      override fun onFailure(reason: Int) = Unit
    })
    
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
    val context = appContext.reactContext ?: return
    val port = serverSocket?.localPort ?: return
    val nsdManager = context.getSystemService(Context.NSD_SERVICE) as NsdManager
    val serviceName = "CrossBeam-${Build.MODEL ?: Build.DEVICE ?: UUID.randomUUID()}"
    localServiceName = serviceName

    val serviceInfo = NsdServiceInfo().apply {
      this.serviceName = serviceName
      this.serviceType = this@CrossBeamNativeModule.serviceType
      this.port = port
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
        setAttribute("platform", localPlatform(context))
      }
    }

    val listener = object : NsdManager.RegistrationListener {
      override fun onServiceRegistered(info: NsdServiceInfo) {
        localServiceName = info.serviceName
      }

      override fun onRegistrationFailed(info: NsdServiceInfo, errorCode: Int) {
        registrationListener = null
      }

      override fun onServiceUnregistered(info: NsdServiceInfo) = Unit
      override fun onUnregistrationFailed(info: NsdServiceInfo, errorCode: Int) = Unit
    }

    registrationListener = listener
    nsdManager.registerService(serviceInfo, NsdManager.PROTOCOL_DNS_SD, listener)
  }

  private fun unregisterLocalService() {
    val context = appContext.reactContext ?: return
    val listener = registrationListener ?: return
    val nsdManager = context.getSystemService(Context.NSD_SERVICE) as NsdManager
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
    val nsdManager = context.getSystemService(Context.NSD_SERVICE) as NsdManager

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
            val id = "${resolved.serviceName}-${host?.hostAddress ?: UUID.randomUUID()}"
            val advertisedPlatform =
              if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                resolved.attributes["platform"]?.toString(Charsets.UTF_8)
              } else {
                null
              }
            val peer = mapOf(
              "id" to id,
              "name" to resolved.serviceName,
              "platform" to (advertisedPlatform ?: inferPeerPlatform(resolved.serviceName)),
              "connection" to "local-network",
              "host" to host?.hostAddress,
              "port" to resolved.port,
              "isTrusted" to false,
              "lastSeenAt" to System.currentTimeMillis()
            )
            peers[id] = peer
            sendEvent("onPeerFound", peer)
          }
        })
      }

      override fun onServiceLost(serviceInfo: NsdServiceInfo) {
        val entry = peers.entries.firstOrNull { it.value["name"] == serviceInfo.serviceName }
        if (entry != null) {
          peers.remove(entry.key)
          sendEvent("onPeerLost", mapOf("id" to entry.key))
        }
      }
    }

    discoveryListener = listener
    nsdManager.discoverServices(serviceType, NsdManager.PROTOCOL_DNS_SD, listener)
  }

  private fun stopNsdDiscovery() {
    val context = appContext.reactContext ?: return
    val listener = discoveryListener ?: return
    val nsdManager = context.getSystemService(Context.NSD_SERVICE) as NsdManager
    try {
      nsdManager.stopServiceDiscovery(listener)
    } catch (_: IllegalArgumentException) {
      // Android throws when discovery already stopped; the desired state is still stopped.
    } finally {
      discoveryListener = null
      peers.clear()
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
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(serviceIntent)
    } else {
        context.startService(serviceIntent)
    }

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
                        null
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
          context.stopService(serviceIntent)
      }
    }
  }

  private fun receiveFilesFromPeer(socket: Socket) {
    val context = appContext.reactContext ?: return
    val peerId = socket.inetAddress.hostAddress ?: "unknown-peer"
    
    // Start Foreground Service
    val serviceIntent = Intent(context, CrossBeamTransferService::class.java)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(serviceIntent)
    } else {
        context.startService(serviceIntent)
    }

    socket.use { client ->
      try {
        DataInputStream(BufferedInputStream(client.getInputStream())).use { input ->
          DataOutputStream(BufferedOutputStream(client.getOutputStream())).use { output ->
            val magic = input.readUTF()
              if (magic != protocolMagic) throw IllegalArgumentException("Unsupported CrossBeam protocol")

              val protocolVersion = input.readInt()
              if (protocolVersion < chunkedProtocolVersion) {
                throw IllegalArgumentException("Unsupported CrossBeam chunk protocol version")
              }

              val transferId = input.readUTF()
            val fileCount = input.readInt()
            val downloadsRoot =
              context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS) ?: context.filesDir
            val outputDir = File(downloadsRoot, "CrossBeam")
            outputDir.mkdirs()

            var batchTotal = 0L
            var batchTransferred = 0L
            val pendingFiles = mutableListOf<IncomingFileHeader>()

            repeat(fileCount) {
              val name = sanitizeFileName(input.readUTF())
              val mimeType = input.readUTF()
              val size = input.readLong()
              val checksum = input.readUTF()
              batchTotal += size
              pendingFiles.add(IncomingFileHeader(name, mimeType, size, checksum))
            }

            // --- Phase 1: Android TV Storage Optimization ---
            val statFs = android.os.StatFs(outputDir.absolutePath)
            val availableBytes = statFs.availableBlocksLong * statFs.blockSizeLong
            val requiredBytes = batchTotal + (500L * 1024L * 1024L) // Safety buffer 500MB
            
            if (availableBytes < requiredBytes) {
                emitTransfer(transferId, peerId, null, 0, batchTotal, "failed", "Insufficient storage on device. Need ${requiredBytes / (1024*1024)} MB.")
                return
            }

            pendingFiles.forEach { header ->
              val destination = uniqueDestination(outputDir, header.name)
              val partial = File(outputDir, "${destination.name}.crossbeam-part")
              val existingSize = if (partial.exists() && partial.isFile) partial.length() else 0L
               
              // Ensure we don't start at an offset greater than the file itself or corrupt it
              val offset = if (existingSize <= header.size) existingSize else 0L
               
              // If we are starting from scratch because it was larger or invalid, delete it
              if (offset == 0L && partial.exists()) {
                  partial.delete()
              }

              // Tell sender where to start
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
                  if (chunkOffset != fileOutput.filePointer) {
                    output.writeBoolean(false)
                    output.writeLong(fileOutput.filePointer)
                    output.flush()
                    throw IllegalStateException("Unexpected chunk offset for ${header.name}")
                  }
                  if (chunkLength <= 0 || chunkLength > transferChunkSize) {
                    output.writeBoolean(false)
                    output.writeLong(fileOutput.filePointer)
                    output.flush()
                    throw IllegalStateException("Invalid chunk length for ${header.name}")
                  }

                  val chunk = ByteArray(chunkLength)
                  input.readFully(chunk)
                  val actualChunkChecksum = sha256(chunk, chunkLength)
                  if (actualChunkChecksum != chunkChecksum) {
                    output.writeBoolean(false)
                    output.writeLong(fileOutput.filePointer)
                    output.flush()
                    throw IllegalStateException("Chunk checksum mismatch for ${header.name}")
                  }

                  fileOutput.write(chunk)
                  remaining -= chunkLength
                  batchTransferred += chunkLength
                  output.writeBoolean(true)
                  output.writeLong(fileOutput.filePointer)
                  output.flush()
                  
                  // Throttle notification updates
                  if (batchTransferred % (DEFAULT_BUFFER_SIZE * 50) == 0L || batchTransferred == batchTotal) {
                      CrossBeamTransferService.updateNotification(
                          context,
                          "Receiving from $peerId",
                          "Progress: ${(batchTransferred * 100 / max(batchTotal, 1L))}%",
                          batchTransferred.toInt(),
                          batchTotal.toInt()
                      )
                  }

                  emitTransfer(
                    transferId,
                    peerId,
                    header.name,
                    batchTransferred,
                    batchTotal,
                    "in-progress",
                    null
                  )
                  }
                }
              }

              if (!partial.exists()) {
                partial.createNewFile()
              }
              val actualChecksum = calculateSha256(partial)
              if (header.checksum.isNotBlank() && header.checksum != actualChecksum) {
                partial.delete()
                throw IllegalStateException("Checksum mismatch for ${header.name}")
              }
              if (destination.exists()) destination.delete()
              partial.renameTo(destination)
            }

            emitTransfer(transferId, peerId, null, batchTotal, batchTotal, "completed", null)
          }
        }
      } catch (error: Exception) {
        emitTransfer(UUID.randomUUID().toString(), peerId, null, 0, 1, "failed", error.message)
      } finally {
          context.stopService(serviceIntent)
      }
    }
  }

  private fun startBleDiscovery() {
    val context = appContext.reactContext ?: return
    val bluetoothManager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
    bluetoothAdapter = bluetoothManager?.adapter

    if (bluetoothAdapter == null || bluetoothAdapter?.isEnabled == false) return

    bleAdvertiser = bluetoothAdapter?.bluetoothLeAdvertiser
    bleScanner = bluetoothAdapter?.bluetoothLeScanner

    // --- Start Advertising ---
    val settings = AdvertiseSettings.Builder()
      .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_BALANCED)
      .setConnectable(true)
      .setTimeout(0)
      .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_MEDIUM)
      .build()

    val data = AdvertiseData.Builder()
      .setIncludeDeviceName(true)
      .addServiceUuid(ParcelUuid(bleServiceUuid))
      .build()

    bleAdvertiseCallback = object : AdvertiseCallback() {
      override fun onStartSuccess(settingsInEffect: AdvertiseSettings?) = Unit
      override fun onStartFailure(errorCode: Int) {
        bleAdvertiseCallback = null
      }
    }

    bleAdvertiser?.startAdvertising(settings, data, bleAdvertiseCallback)

    // --- Start Scanning ---
    val filter = ScanFilter.Builder()
      .setServiceUuid(ParcelUuid(bleServiceUuid))
      .build()

    bleScanCallback = object : ScanCallback() {
      override fun onScanResult(callbackType: Int, result: ScanResult) {
        val device = result.device
        val name = result.scanRecord?.deviceName ?: device.name ?: "Unknown BLE Peer"
        val id = "ble-${device.address}"
        
        if (peers.containsKey(id)) return

        val peer = mapOf(
          "id" to id,
          "name" to name,
          "platform" to inferPeerPlatform(name),
          "connection" to "ble",
          "isTrusted" to false,
          "lastSeenAt" to System.currentTimeMillis()
        )
        peers[id] = peer
        sendEvent("onPeerFound", peer)
      }

      override fun onScanFailed(errorCode: Int) {
        bleScanCallback = null
      }
    }

    bleScanner?.startScan(listOf(filter), android.bluetooth.le.ScanSettings.Builder().build(), bleScanCallback)
  }

  private fun stopBleDiscovery() {
    try {
      bleAdvertiser?.stopAdvertising(bleAdvertiseCallback)
      bleScanner?.stopScan(bleScanCallback)
    } catch (_: Exception) {}
    bleAdvertiseCallback = null
    bleScanCallback = null
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
    errorMessage: String?
  ) {
    sendEvent(
      "onTransferProgress",
      mapOf(
        "transferId" to transferId,
        "peerId" to peerId,
        "fileName" to fileName,
        "bytesTransferred" to bytesTransferred,
        "totalBytes" to totalBytes,
        "status" to status,
        "errorMessage" to errorMessage
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
