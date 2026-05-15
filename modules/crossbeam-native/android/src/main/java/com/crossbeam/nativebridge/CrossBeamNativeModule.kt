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
import java.io.FileOutputStream
import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket
import java.security.MessageDigest
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import kotlin.concurrent.thread
import kotlin.math.max

class CrossBeamNativeModule : Module() {
  private val peers = ConcurrentHashMap<String, Map<String, Any?>>()
  private var discoveryListener: NsdManager.DiscoveryListener? = null
  private var registrationListener: NsdManager.RegistrationListener? = null
  private var serverSocket: ServerSocket? = null
  private var serverThread: Thread? = null
  private var localServiceName: String? = null
  private val serviceType = "_crossbeam._tcp."
  private val protocolMagic = "CROSSBEAM1"

  override fun definition() = ModuleDefinition {
    Name("CrossBeamNative")

    Events("onPeerFound", "onPeerLost", "onTransferProgress")

    AsyncFunction("isAvailable") {
      true
    }

    AsyncFunction("getPlatformCapabilities") {
      val capabilities = mutableListOf(
        "local-network-discovery",
        "local-network-advertising",
        "socket-stream-transfer",
        "sha256-integrity"
      )
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        capabilities.add("wifi-direct-api-available")
      }
      capabilities
    }

    AsyncFunction("startDiscovery") {
      startTransferServer()
      registerLocalService()
      startNsdDiscovery()
    }

    AsyncFunction("stopDiscovery") {
      stopNsdDiscovery()
      unregisterLocalService()
      stopTransferServer()
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
      Unit
    }

    AsyncFunction("pauseTransfer") { transferId: String ->
      throw IllegalStateException("Pause requires the chunk checkpoint transfer service.")
    }

    AsyncFunction("resumeTransfer") { transferId: String ->
      throw IllegalStateException("Resume requires the Android chunk checkpoint transfer service.")
    }
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
        setAttribute("platform", "android")
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
            val peer = mapOf(
              "id" to id,
              "name" to resolved.serviceName,
              "platform" to "android",
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
          DataOutputStream(BufferedOutputStream(socket.getOutputStream())).use { output ->
            output.writeUTF(protocolMagic)
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
              output.flush()

              context.contentResolver.openInputStream(file.uri)?.use { rawInput ->
                BufferedInputStream(rawInput).use { input ->
                  val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
                  var read = input.read(buffer)
                  while (read >= 0) {
                    output.write(buffer, 0, read)
                    transferred += read
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

        emitTransfer(transferId, peerId, null, totalBytes, totalBytes, "completed", null)
      } catch (error: Exception) {
        emitTransfer(transferId, peerId, null, transferred, max(totalBytes, 1L), "failed", error.message)
      }
    }
  }

  private fun receiveFilesFromPeer(socket: Socket) {
    val context = appContext.reactContext ?: return
    val peerId = socket.inetAddress.hostAddress ?: "unknown-peer"
    socket.use { client ->
      try {
        DataInputStream(BufferedInputStream(client.getInputStream())).use { input ->
          val magic = input.readUTF()
          if (magic != protocolMagic) throw IllegalArgumentException("Unsupported CrossBeam protocol")

          val transferId = input.readUTF()
          val fileCount = input.readInt()
          val outputDir = File(
            context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS),
            "CrossBeam"
          )
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

          pendingFiles.forEach { header ->
            val destination = uniqueDestination(outputDir, header.name)
            val digest = MessageDigest.getInstance("SHA-256")
            FileOutputStream(destination).use { fileOutput ->
              var remaining = header.size
              val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
              while (remaining > 0) {
                val read = input.read(buffer, 0, minOf(buffer.size.toLong(), remaining).toInt())
                if (read < 0) throw IllegalStateException("Connection closed during transfer")
                fileOutput.write(buffer, 0, read)
                digest.update(buffer, 0, read)
                remaining -= read
                batchTransferred += read
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

            val actualChecksum = digest.digest().joinToString("") { "%02x".format(it) }
            if (header.checksum.isNotBlank() && header.checksum != actualChecksum) {
              destination.delete()
              throw IllegalStateException("Checksum mismatch for ${header.name}")
            }
          }

          emitTransfer(transferId, peerId, null, batchTotal, batchTotal, "completed", null)
        }
      } catch (error: Exception) {
        emitTransfer(UUID.randomUUID().toString(), peerId, null, 0, 1, "failed", error.message)
      }
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
}
