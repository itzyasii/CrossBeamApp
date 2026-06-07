package com.crossbeam.nativebridge

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class NotificationActionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context?, intent: Intent?) {
    try {
      val transferId = intent?.getStringExtra("transferId") ?: return
      val action = intent.getStringExtra("action") ?: return
      when (action) {
        "accept" -> CrossBeamNativeModule.handleNotificationActionFromReceiver(transferId, true)
        "reject" -> CrossBeamNativeModule.handleNotificationActionFromReceiver(transferId, false)
        else -> Log.w("NotificationActionReceiver", "Unknown action: $action")
      }
    } catch (e: Exception) {
      Log.e("NotificationActionReceiver", "Failed to handle notification action", e)
    }
  }
}
