package com.crossbeam.nativebridge

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

class ForegroundTransferService : Service() {
  private val CHANNEL_ID = "crossbeam-foreground"

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val nm = getSystemService(NotificationManager::class.java)
      val chan = NotificationChannel(CHANNEL_ID, "CrossBeam Service", NotificationManager.IMPORTANCE_LOW)
      chan.setShowBadge(false)
      nm.createNotificationChannel(chan)
    }
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val notification = NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("CrossBeam")
      .setContentText("Sharing enabled")
      .setSmallIcon(android.R.drawable.stat_sys_upload)
      .setOngoing(true)
      .build()

    startForeground(1001, notification)
    return START_STICKY
  }

  override fun onDestroy() {
    stopForeground(true)
    super.onDestroy()
  }
}
