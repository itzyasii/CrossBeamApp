package com.crossbeam.nativebridge

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.net.InetAddress
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

class CrossBeamNativeModule : Module() {
  private val peers = ConcurrentHashMap<String, Map<String, Any?>>()
  private var discoveryListener: NsdManager.DiscoveryListener? = null
  private val serviceType = "_crossbeam._tcp."

  override fun definition() = ModuleDefinition {
    Name("CrossBeamNative")

    Events("onPeerFound", "onPeerLost", "onTransferProgress")

    AsyncFunction("isAvailable") {
      true
    }

    AsyncFunction("getPlatformCapabilities") {
      val capabilities = mutableListOf("local-network-discovery")
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        capabilities.add("wifi-direct-api-available")
      }
      capabilities
    }

    AsyncFunction("startDiscovery") {
      startNsdDiscovery()
    }

    AsyncFunction("stopDiscovery") {
      stopNsdDiscovery()
    }

    AsyncFunction("getDiscoveredPeers") {
      peers.values.toList()
    }

    AsyncFunction("sendFiles") { request: Map<String, Any?> ->
      throw IllegalStateException(
        "Native Android streaming transfer is not enabled yet. Add the foreground socket transfer service before sending files."
      )
    }

    AsyncFunction("cancelTransfer") { transferId: String ->
      Unit
    }

    AsyncFunction("pauseTransfer") { transferId: String ->
      throw IllegalStateException("Pause requires the Android chunk checkpoint transfer service.")
    }

    AsyncFunction("resumeTransfer") { transferId: String ->
      throw IllegalStateException("Resume requires the Android chunk checkpoint transfer service.")
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
}

