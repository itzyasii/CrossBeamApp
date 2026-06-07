import ExpoModulesCore
import CryptoKit
import MultipeerConnectivity
import Security
import UIKit

public final class CrossBeamNativeModule: Module {
  private let serviceType = "crossbeam"
  private let chunkProtocolName = "crossbeam-chunk-v2"
  private let chunkProtocolVersion = 2
  private let chunkSizeBytes = 1024 * 1024
  private var peerId: MCPeerID?
  private var session: MCSession?
  private var advertiser: MCNearbyServiceAdvertiser?
  private var browser: MCNearbyServiceBrowser?
  private var peers: [String: [String: Any?]] = [:]
  private var peerIds: [String: MCPeerID] = [:]
  private var pendingTransfersByPeer: [String: PendingTransfer] = [:]
  private var progressObservers: [String: NSKeyValueObservation] = [:]
  private var transferProgress: [String: [Progress]] = [:]
  private var cancelledTransfers = Set<String>()
  private var pausedTransfers = Set<String>()
  private let transferStateLock = NSLock()
  private var chunkAcks: [String: ChunkAck] = [:]
  private let chunkAckCondition = NSCondition()

  public func definition() -> ModuleDefinition {
    Name("CrossBeamNative")

    Events("onPeerFound", "onPeerLost", "onTransferProgress", "onBackgroundTransferProgress", "onBackgroundTransferStatus")

    AsyncFunction("isAvailable") {
      return true
    }

    AsyncFunction("getPlatformCapabilities") {
      return [
        "multipeer-discovery",
        "multipeer-stream-transfer",
        "app-managed-chunk-stream",
        "chunk-ack-resume",
        "sha256-integrity",
        "encrypted-session",
        "keychain-secure-storage",
        "share-extension-intake",
        "qr-pairing"
      ]
    }

    AsyncFunction("getChunkProtocol") {
      return [
        "protocol": self.chunkProtocolName,
        "version": self.chunkProtocolVersion,
        "chunkSizeBytes": self.chunkSizeBytes,
        "supportsChunkAck": true,
        "supportsPause": true,
        "supportsResume": true,
        "supportsRetry": true
      ]
    }

    AsyncFunction("startDiscovery") {
      self.startMultipeer()
    }

    AsyncFunction("stopDiscovery") {
      self.stopMultipeer()
    }

    AsyncFunction("getDiscoveredPeers") {
      return Array(self.peers.values)
    }

    AsyncFunction("sendFiles") { (request: [String: Any?]) in
      guard let peerId = request["peerId"] as? String else {
        throw Exception(name: "InvalidTransferRequest", description: "Missing peerId")
      }
      guard let files = request["files"] as? [[String: Any?]], !files.isEmpty else {
        throw Exception(name: "InvalidTransferRequest", description: "Missing files")
      }
      guard let remotePeer = self.peerIds[peerId] else {
        throw Exception(name: "PeerUnavailable", description: "Peer is not available")
      }
      guard let session = self.session, let browser = self.browser else {
        throw Exception(name: "SessionUnavailable", description: "Multipeer session is not active")
      }

      let transferId = UUID().uuidString
      let transfer = PendingTransfer(
        id: transferId,
        peer: remotePeer,
        files: files.compactMap { PendingFile.from($0) }
      )
      guard !transfer.files.isEmpty else {
        throw Exception(name: "InvalidTransferRequest", description: "No readable files were provided")
      }

      self.pendingTransfersByPeer[remotePeer.displayName] = transfer
      if session.connectedPeers.contains(remotePeer) {
        self.sendPendingTransfer(transfer)
      } else {
        browser.invitePeer(remotePeer, to: session, withContext: nil, timeout: 30)
      }

      return ["transferId": transferId]
    }

    AsyncFunction("cancelTransfer") { (_ transferId: String) in
      self.markCancelled(transferId)
      self.transferProgress[transferId]?.forEach { $0.cancel() }
      self.transferProgress.removeValue(forKey: transferId)
      self.sendTransferEvent(
        transferId: transferId,
        peerId: "unknown-peer",
        fileName: nil,
        bytesTransferred: 0,
        totalBytes: 1,
        status: "cancelled",
        errorMessage: nil
      )
      return
    }

    AsyncFunction("pauseTransfer") { (_ transferId: String) in
      self.markPaused(transferId)
      self.sendTransferEvent(
        transferId: transferId,
        peerId: "unknown-peer",
        fileName: nil,
        bytesTransferred: 0,
        totalBytes: 1,
        status: "paused",
        errorMessage: nil
      )
      return
    }

    AsyncFunction("resumeTransfer") { (_ transferId: String) in
      self.markResumed(transferId)
      self.sendTransferEvent(
        transferId: transferId,
        peerId: "unknown-peer",
        fileName: nil,
        bytesTransferred: 0,
        totalBytes: 1,
        status: "in-progress",
        errorMessage: nil
      )
      return
    }

    AsyncFunction("storeSecureValue") { (alias: String, value: String) in
      try self.storeKeychainValue(alias: alias, value: value)
      return value
    }

    AsyncFunction("retrieveSecureValue") { (alias: String, encryptedValue: String) in
      return try self.retrieveKeychainValue(alias: alias)
    }

    AsyncFunction("configureBackgroundSession") { (identifier: String) in
      self.configureBackgroundSession(identifier)
      return true
    }

    AsyncFunction("startBackgroundTransfer") { (transferId: String, config: [String: Any]) in
      return self.startBackgroundTransfer(transferId: transferId, config: config)
    }

    AsyncFunction("getBackgroundTransferStatus") { (transferId: String) in
      return self.getBackgroundTransferStatus(transferId) ?? [:]
    }

    AsyncFunction("pauseBackgroundTransfer") { (transferId: String) in
      return self.pauseBackgroundTransfer(transferId)
    }

    AsyncFunction("resumeBackgroundTransfer") { (transferId: String) in
      return self.resumeBackgroundTransfer(transferId)
    }

    AsyncFunction("cancelBackgroundTransfer") { (transferId: String) in
      return self.cancelBackgroundTransfer(transferId)
    }
  }

  private func storeKeychainValue(alias: String, value: String) throws {
    guard let data = value.data(using: .utf8) else {
      throw Exception(name: "InvalidSecureValue", description: "Unable to encode secure value")
    }

    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: "CrossBeamNative",
      kSecAttrAccount as String: alias
    ]
    SecItemDelete(query as CFDictionary)

    var attributes = query
    attributes[kSecValueData as String] = data
    attributes[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly

    let status = SecItemAdd(attributes as CFDictionary, nil)
    guard status == errSecSuccess else {
      throw Exception(name: "KeychainStoreFailed", description: "Unable to store secure value")
    }
  }

  private func retrieveKeychainValue(alias: String) throws -> String {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: "CrossBeamNative",
      kSecAttrAccount as String: alias,
      kSecReturnData as String: true,
      kSecMatchLimit as String: kSecMatchLimitOne
    ]

    var item: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &item)
    guard status == errSecSuccess, let data = item as? Data, let value = String(data: data, encoding: .utf8) else {
      throw Exception(name: "KeychainValueMissing", description: "Secure value was not found")
    }
    return value
  }

  private func startMultipeer() {
    if peerId == nil {
      peerId = MCPeerID(displayName: UIDevice.current.name)
    }
    guard let peerId else { return }

    session = MCSession(peer: peerId, securityIdentity: nil, encryptionPreference: .required)
    session?.delegate = self
    advertiser = MCNearbyServiceAdvertiser(peer: peerId, discoveryInfo: ["platform": "ios"], serviceType: serviceType)
    browser = MCNearbyServiceBrowser(peer: peerId, serviceType: serviceType)

    advertiser?.delegate = self
    browser?.delegate = self
    advertiser?.startAdvertisingPeer()
    browser?.startBrowsingForPeers()
  }

  private func stopMultipeer() {
    advertiser?.stopAdvertisingPeer()
    browser?.stopBrowsingForPeers()
    session?.disconnect()
    advertiser = nil
    browser = nil
    session = nil
    peers.removeAll()
    peerIds.removeAll()
    pendingTransfersByPeer.removeAll()
    progressObservers.removeAll()
    transferProgress.removeAll()
  }

  private func sendPendingTransfer(_ transfer: PendingTransfer) {
    DispatchQueue.global(qos: .utility).async {
      guard let session = self.session else { return }
      let totalBytes = transfer.files.reduce(0) { $0 + $1.sizeBytes }
      var completedBytes: Int64 = 0
      var output: OutputStream?

      do {
        output = try session.startStream(withName: "\(self.chunkProtocolName):\(transfer.id)", toPeer: transfer.peer)
        output?.open()
        guard let output else {
          throw NSError(domain: "CrossBeamNative", code: 2, userInfo: [NSLocalizedDescriptionKey: "Unable to open transfer stream"])
        }

        let filePayload = transfer.files.map { file in
          [
            "id": file.id,
            "name": file.name,
            "sizeBytes": file.sizeBytes,
            "mimeType": file.mimeType ?? "application/octet-stream",
            "checksum": (try? sha256File(file.url)) ?? ""
          ] as [String : Any]
        }

        try writeJsonLine([
          "type": "transfer",
          "protocol": self.chunkProtocolName,
          "version": self.chunkProtocolVersion,
          "transferId": transfer.id,
          "chunkSizeBytes": self.chunkSizeBytes,
          "files": filePayload
        ], to: output)

        for file in transfer.files {
          if self.isCancelled(transfer.id) {
            throw TransferCancelledError()
          }

          let ready = try self.waitForChunkAck(
            transferId: transfer.id,
            fileId: file.id,
            minimumOffset: 0,
            timeout: 60
          )
          if !ready.accepted {
            throw NSError(domain: "CrossBeamNative", code: 3, userInfo: [NSLocalizedDescriptionKey: ready.error ?? "Receiver rejected transfer"])
          }

          let resumeOffset = min(max(ready.offset, 0), file.sizeBytes)
          completedBytes += resumeOffset
          let handle = try FileHandle(forReadingFrom: file.url)
          defer { try? handle.close() }
          try handle.seek(toOffset: UInt64(resumeOffset))

          var fileOffset = resumeOffset
          while fileOffset < file.sizeBytes {
            if self.isCancelled(transfer.id) {
              throw TransferCancelledError()
            }
            while self.isPaused(transfer.id) {
              Thread.sleep(forTimeInterval: 0.25)
              if self.isCancelled(transfer.id) {
                throw TransferCancelledError()
              }
            }

            let nextLength = min(self.chunkSizeBytes, Int(file.sizeBytes - fileOffset))
            let chunk = handle.readData(ofLength: nextLength)
            if chunk.isEmpty {
              throw NSError(domain: "CrossBeamNative", code: 4, userInfo: [NSLocalizedDescriptionKey: "File ended before all bytes were sent"])
            }

            try writeJsonLine([
              "type": "chunk",
              "transferId": transfer.id,
              "fileId": file.id,
              "fileName": file.name,
              "offset": fileOffset,
              "length": chunk.count,
              "checksum": sha256Data(chunk)
            ], to: output)
            try writeData(chunk, to: output)

            let expectedOffset = fileOffset + Int64(chunk.count)
            let ack = try self.waitForChunkAck(
              transferId: transfer.id,
              fileId: file.id,
              minimumOffset: expectedOffset,
              timeout: 60
            )
            if !ack.accepted {
              throw NSError(domain: "CrossBeamNative", code: 5, userInfo: [NSLocalizedDescriptionKey: ack.error ?? "Receiver rejected chunk"])
            }

            fileOffset = expectedOffset
            completedBytes += Int64(chunk.count)
            self.sendTransferEvent(
              transferId: transfer.id,
              peerId: transfer.peer.displayName,
              fileName: file.name,
              bytesTransferred: min(completedBytes, totalBytes),
              totalBytes: max(totalBytes, 1),
              status: "in-progress",
              errorMessage: nil
            )
          }

          try writeJsonLine([
            "type": "fileEnd",
            "transferId": transfer.id,
            "fileName": file.name
          ], to: output)
        }

        try writeJsonLine([
          "type": "complete",
          "transferId": transfer.id
        ], to: output)

        self.sendTransferEvent(
          transferId: transfer.id,
          peerId: transfer.peer.displayName,
          fileName: nil,
          bytesTransferred: totalBytes,
          totalBytes: max(totalBytes, 1),
          status: "completed",
          errorMessage: nil
        )
      } catch is TransferCancelledError {
        self.sendTransferEvent(
          transferId: transfer.id,
          peerId: transfer.peer.displayName,
          fileName: nil,
          bytesTransferred: completedBytes,
          totalBytes: max(totalBytes, 1),
          status: "cancelled",
          errorMessage: nil
        )
      } catch {
        self.sendTransferEvent(
          transferId: transfer.id,
          peerId: transfer.peer.displayName,
          fileName: nil,
          bytesTransferred: completedBytes,
          totalBytes: max(totalBytes, 1),
          status: "failed",
          errorMessage: error.localizedDescription
        )
      }

      output?.close()
      self.clearTransferState(transfer.id)
    }
  }

  private func receiveChunkStream(_ input: InputStream, from peerID: MCPeerID, session: MCSession) {
    input.open()
    defer { input.close() }

    do {
      guard
        let headerLine = try readLine(from: input),
        let header = try jsonDictionary(from: headerLine),
        header["type"] as? String == "transfer",
        header["protocol"] as? String == chunkProtocolName,
        let transferId = header["transferId"] as? String,
        let files = header["files"] as? [[String: Any]]
      else {
        throw NSError(domain: "CrossBeamNative", code: 6, userInfo: [NSLocalizedDescriptionKey: "Invalid CrossBeam chunk stream header"])
      }

      let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
      let crossBeamDirectory = documents.appendingPathComponent("CrossBeam", isDirectory: true)
      try FileManager.default.createDirectory(at: crossBeamDirectory, withIntermediateDirectories: true)
      let totalBytes = files.reduce(Int64(0)) { total, file in
        total + ((file["sizeBytes"] as? NSNumber)?.int64Value ?? file["sizeBytes"] as? Int64 ?? 0)
      }
      var completedBytes: Int64 = 0

      for file in files {
        let fileName = sanitizeFileName(file["name"] as? String ?? "received-file")
        let fileId = file["id"] as? String ?? fileName
        let expectedSize = (file["sizeBytes"] as? NSNumber)?.int64Value ?? file["sizeBytes"] as? Int64 ?? 0
        let expectedChecksum = file["checksum"] as? String ?? ""
        let destination = uniqueDestination(in: crossBeamDirectory, fileName: fileName)
        let partial = crossBeamDirectory.appendingPathComponent("\(destination.lastPathComponent).crossbeam-part")
        var offset = partialFileSize(partial)

        if offset > expectedSize {
          try? FileManager.default.removeItem(at: partial)
          offset = 0
        }
        if expectedSize == 0 && !FileManager.default.fileExists(atPath: partial.path) {
          _ = FileManager.default.createFile(atPath: partial.path, contents: nil)
        }

        completedBytes += offset
        try sendChunkAck(session: session, peerID: peerID, transferId: transferId, fileId: fileId, fileName: fileName, offset: offset, accepted: true, error: nil)

        if offset < expectedSize {
          if !FileManager.default.fileExists(atPath: partial.path) {
            _ = FileManager.default.createFile(atPath: partial.path, contents: nil)
          }

          let handle = try FileHandle(forWritingTo: partial)
          defer { try? handle.close() }
          try handle.seek(toOffset: UInt64(offset))

          while offset < expectedSize {
            guard
              let chunkLine = try readLine(from: input),
              let chunkHeader = try jsonDictionary(from: chunkLine),
              chunkHeader["type"] as? String == "chunk"
            else {
              throw NSError(domain: "CrossBeamNative", code: 7, userInfo: [NSLocalizedDescriptionKey: "Missing chunk header"])
            }

            let chunkOffset = (chunkHeader["offset"] as? NSNumber)?.int64Value ?? chunkHeader["offset"] as? Int64 ?? -1
            let chunkLength = (chunkHeader["length"] as? NSNumber)?.intValue ?? chunkHeader["length"] as? Int ?? 0
            let chunkChecksum = chunkHeader["checksum"] as? String ?? ""
            let chunkFileId = chunkHeader["fileId"] as? String ?? chunkHeader["fileName"] as? String ?? ""

            guard chunkFileId == fileId, chunkOffset == offset, chunkLength > 0, chunkLength <= chunkSizeBytes else {
              try sendChunkAck(session: session, peerID: peerID, transferId: transferId, fileId: fileId, fileName: fileName, offset: offset, accepted: false, error: "Unexpected chunk target, offset, or length")
              throw NSError(domain: "CrossBeamNative", code: 8, userInfo: [NSLocalizedDescriptionKey: "Unexpected chunk target, offset, or length"])
            }

            let chunk = try readExact(length: chunkLength, from: input)
            guard sha256Data(chunk) == chunkChecksum else {
              try sendChunkAck(session: session, peerID: peerID, transferId: transferId, fileId: fileId, fileName: fileName, offset: offset, accepted: false, error: "Chunk checksum mismatch")
              throw NSError(domain: "CrossBeamNative", code: 9, userInfo: [NSLocalizedDescriptionKey: "Chunk checksum mismatch"])
            }

            try handle.write(contentsOf: chunk)
            offset += Int64(chunk.count)
            completedBytes += Int64(chunk.count)
            try sendChunkAck(session: session, peerID: peerID, transferId: transferId, fileId: fileId, fileName: fileName, offset: offset, accepted: true, error: nil)
            sendTransferEvent(
              transferId: transferId,
              peerId: peerID.displayName,
              fileName: fileName,
              bytesTransferred: min(completedBytes, totalBytes),
              totalBytes: max(totalBytes, 1),
              status: "in-progress",
              errorMessage: nil
            )
          }
        }

        guard
          let endLine = try readLine(from: input),
          let endHeader = try jsonDictionary(from: endLine),
          endHeader["type"] as? String == "fileEnd"
        else {
          throw NSError(domain: "CrossBeamNative", code: 10, userInfo: [NSLocalizedDescriptionKey: "Missing file completion marker"])
        }

        if !expectedChecksum.isEmpty && try sha256File(partial) != expectedChecksum {
          try? FileManager.default.removeItem(at: partial)
          throw NSError(domain: "CrossBeamNative", code: 11, userInfo: [NSLocalizedDescriptionKey: "File checksum mismatch"])
        }

        if FileManager.default.fileExists(atPath: destination.path) {
          try FileManager.default.removeItem(at: destination)
        }
        try FileManager.default.moveItem(at: partial, to: destination)
      }

      _ = try readLine(from: input)
      sendTransferEvent(
        transferId: transferId,
        peerId: peerID.displayName,
        fileName: nil,
        bytesTransferred: totalBytes,
        totalBytes: max(totalBytes, 1),
        status: "completed",
        errorMessage: nil
      )
    } catch {
      sendTransferEvent(
        transferId: UUID().uuidString,
        peerId: peerID.displayName,
        fileName: nil,
        bytesTransferred: 0,
        totalBytes: 1,
        status: "failed",
        errorMessage: error.localizedDescription
      )
    }
  }

  private func sendTransferEvent(
    transferId: String,
    peerId: String,
    fileName: String?,
    bytesTransferred: Int64,
    totalBytes: Int64,
    status: String,
    errorMessage: String?
  ) {
    sendEvent("onTransferProgress", [
      "transferId": transferId,
      "peerId": peerId,
      "fileName": fileName,
      "bytesTransferred": bytesTransferred,
      "totalBytes": totalBytes,
      "status": status,
      "errorMessage": errorMessage
    ])
  }

  private func markCancelled(_ transferId: String) {
    transferStateLock.lock()
    cancelledTransfers.insert(transferId)
    pausedTransfers.remove(transferId)
    transferStateLock.unlock()
  }

  private func markPaused(_ transferId: String) {
    transferStateLock.lock()
    pausedTransfers.insert(transferId)
    transferStateLock.unlock()
  }

  private func markResumed(_ transferId: String) {
    transferStateLock.lock()
    pausedTransfers.remove(transferId)
    transferStateLock.unlock()
  }

  private func isCancelled(_ transferId: String) -> Bool {
    transferStateLock.lock()
    let cancelled = cancelledTransfers.contains(transferId)
    transferStateLock.unlock()
    return cancelled
  }

  private func isPaused(_ transferId: String) -> Bool {
    transferStateLock.lock()
    let paused = pausedTransfers.contains(transferId)
    transferStateLock.unlock()
    return paused
  }

  private func clearTransferState(_ transferId: String) {
    transferStateLock.lock()
    cancelledTransfers.remove(transferId)
    pausedTransfers.remove(transferId)
    transferStateLock.unlock()
  }

  private func waitForChunkAck(transferId: String, fileId: String, minimumOffset: Int64, timeout: TimeInterval) throws -> ChunkAck {
    let key = chunkAckKey(transferId: transferId, fileId: fileId)
    let deadline = Date().addingTimeInterval(timeout)
    chunkAckCondition.lock()
    defer { chunkAckCondition.unlock() }

    while true {
      if let ack = chunkAcks[key], !ack.accepted || ack.offset >= minimumOffset {
        chunkAcks.removeValue(forKey: key)
        return ack
      }

      if Date() >= deadline {
        throw NSError(domain: "CrossBeamNative", code: 12, userInfo: [NSLocalizedDescriptionKey: "Timed out waiting for receiver checkpoint"])
      }
      chunkAckCondition.wait(until: min(Date().addingTimeInterval(0.5), deadline))
    }
  }

  private func rememberChunkAck(_ ack: ChunkAck) {
    let key = chunkAckKey(transferId: ack.transferId, fileId: ack.fileId)
    chunkAckCondition.lock()
    chunkAcks[key] = ack
    chunkAckCondition.signal()
    chunkAckCondition.unlock()
  }

  private func chunkAckKey(transferId: String, fileId: String) -> String {
    "\(transferId)|\(fileId)"
  }

  // MARK: - Background URLSession support
  private var backgroundSession: URLSession?
  private var backgroundTasks: [String: URLSessionTask] = [:]
  private var backgroundTaskMap: [Int: String] = [:]
  private var backgroundStatus: [String: [String: Any]] = [:]

  public func configureBackgroundSession(_ identifier: String) {
    let config = URLSessionConfiguration.background(withIdentifier: identifier)
    config.httpMaximumConnectionsPerHost = 4
    backgroundSession = URLSession(configuration: config, delegate: self, delegateQueue: OperationQueue())
  }

  public func startBackgroundTransfer(transferId: String, config: [String: Any]) -> Bool {
    guard let session = backgroundSession else { return false }
    guard let urlString = config["url"] as? String, let url = URL(string: urlString) else { return false }
    let method = (config["method"] as? String)?.uppercased() ?? "GET"
    var request = URLRequest(url: url)
    request.httpMethod = method
    if let headers = config["headers"] as? [String: String] {
      for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
    }

    let task: URLSessionTask
    if method == "GET" {
      task = session.downloadTask(with: request)
    } else {
      // For POST/PUT use empty body if none provided
      if let fileUri = config["fileUri"] as? String, let fileUrl = URL(string: fileUri), FileManager.default.fileExists(atPath: fileUrl.path) {
        task = session.uploadTask(with: request, fromFile: fileUrl)
      } else {
        task = session.uploadTask(with: request, from: Data())
      }
    }

    backgroundTasks[transferId] = task
    backgroundTaskMap[task.taskIdentifier] = transferId
    backgroundStatus[transferId] = ["transferId": transferId, "status": "running", "progress": 0, "bytesTransferred": 0, "totalBytes": 0]
    task.resume()
    sendEvent("onBackgroundTransferStatus", backgroundStatus[transferId]!)
    return true
  }

  public func getBackgroundTransferStatus(_ transferId: String) -> [String: Any]? {
    return backgroundStatus[transferId]
  }

  public func pauseBackgroundTransfer(_ transferId: String) -> Bool {
    guard let task = backgroundTasks[transferId] else { return false }
    task.suspend()
    backgroundStatus[transferId]?["status"] = "paused"
    sendEvent("onBackgroundTransferStatus", backgroundStatus[transferId]!)
    return true
  }

  public func resumeBackgroundTransfer(_ transferId: String) -> Bool {
    guard let task = backgroundTasks[transferId] else { return false }
    task.resume()
    backgroundStatus[transferId]?["status"] = "running"
    sendEvent("onBackgroundTransferStatus", backgroundStatus[transferId]!)
    return true
  }

  public func cancelBackgroundTransfer(_ transferId: String) -> Bool {
    guard let task = backgroundTasks[transferId] else { return false }
    task.cancel()
    backgroundStatus[transferId]?["status"] = "cancelled"
    sendEvent("onBackgroundTransferStatus", backgroundStatus[transferId]!)
    backgroundTasks.removeValue(forKey: transferId)
    return true
  }
}

extension CrossBeamNativeModule: URLSessionDelegate, URLSessionTaskDelegate, URLSessionDataDelegate, URLSessionDownloadDelegate {
  public func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
    guard let transferId = backgroundTaskMap[task.taskIdentifier] else { return }
    if let error = error {
      backgroundStatus[transferId]?["status"] = "failed"
      backgroundStatus[transferId]?["error"] = error.localizedDescription
    } else {
      backgroundStatus[transferId]?["status"] = "completed"
    }
    sendEvent("onBackgroundTransferStatus", backgroundStatus[transferId]!)
    backgroundTasks.removeValue(forKey: transferId)
    backgroundTaskMap.removeValue(forKey: task.taskIdentifier)
  }

  public func urlSession(_ session: URLSession, task: URLSessionTask, didSendBodyData bytesSent: Int64, totalBytesSent: Int64, totalBytesExpectedToSend: Int64) {
    guard let transferId = backgroundTaskMap[task.taskIdentifier] else { return }
    let progress = totalBytesExpectedToSend > 0 ? Double(totalBytesSent) / Double(totalBytesExpectedToSend) : 0
    backgroundStatus[transferId] = ["transferId": transferId, "status": "running", "progress": progress, "bytesTransferred": totalBytesSent, "totalBytes": totalBytesExpectedToSend]
    sendEvent("onBackgroundTransferProgress", backgroundStatus[transferId]!)
  }

  public func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didWriteData bytesWritten: Int64, totalBytesWritten: Int64, totalBytesExpectedToWrite: Int64) {
    guard let transferId = backgroundTaskMap[downloadTask.taskIdentifier] else { return }
    let progress = totalBytesExpectedToWrite > 0 ? Double(totalBytesWritten) / Double(totalBytesExpectedToWrite) : 0
    backgroundStatus[transferId] = ["transferId": transferId, "status": "running", "progress": progress, "bytesTransferred": totalBytesWritten, "totalBytes": totalBytesExpectedToWrite]
    sendEvent("onBackgroundTransferProgress", backgroundStatus[transferId]!)
  }
}

extension CrossBeamNativeModule: MCNearbyServiceBrowserDelegate {
  public func browser(_ browser: MCNearbyServiceBrowser, foundPeer peerID: MCPeerID, withDiscoveryInfo info: [String : String]?) {
    let peer: [String: Any?] = [
      "id": peerID.displayName,
      "name": peerID.displayName,
      "platform": info?["platform"] ?? "ios",
      "connection": "multipeer",
      "host": nil,
      "port": nil,
      "isTrusted": false,
      "lastSeenAt": Int(Date().timeIntervalSince1970 * 1000)
    ]
    peers[peerID.displayName] = peer
    peerIds[peerID.displayName] = peerID
    sendEvent("onPeerFound", peer)
  }

  public func browser(_ browser: MCNearbyServiceBrowser, lostPeer peerID: MCPeerID) {
    peers.removeValue(forKey: peerID.displayName)
    peerIds.removeValue(forKey: peerID.displayName)
    sendEvent("onPeerLost", ["id": peerID.displayName])
  }

  public func browser(_ browser: MCNearbyServiceBrowser, didNotStartBrowsingForPeers error: Error) {}
}

extension CrossBeamNativeModule: MCNearbyServiceAdvertiserDelegate {
  public func advertiser(_ advertiser: MCNearbyServiceAdvertiser, didReceiveInvitationFromPeer peerID: MCPeerID, withContext context: Data?, invitationHandler: @escaping (Bool, MCSession?) -> Void) {
    invitationHandler(true, session)
  }

  public func advertiser(_ advertiser: MCNearbyServiceAdvertiser, didNotStartAdvertisingPeer error: Error) {}
}

extension CrossBeamNativeModule: MCSessionDelegate {
  public func session(_ session: MCSession, peer peerID: MCPeerID, didChange state: MCSessionState) {
    if state == .connected, let transfer = pendingTransfersByPeer.removeValue(forKey: peerID.displayName) {
      sendPendingTransfer(transfer)
    }
  }

  public func session(_ session: MCSession, didReceive data: Data, fromPeer peerID: MCPeerID) {
    guard
      let dictionary = try? jsonDictionary(from: data),
      dictionary["type"] as? String == "chunkAck",
      let transferId = dictionary["transferId"] as? String,
      let fileName = dictionary["fileName"] as? String
    else {
      return
    }

    let fileId = dictionary["fileId"] as? String ?? fileName
    let offset = (dictionary["offset"] as? NSNumber)?.int64Value ?? dictionary["offset"] as? Int64 ?? 0
    let accepted = dictionary["accepted"] as? Bool ?? false
    rememberChunkAck(ChunkAck(
      transferId: transferId,
      fileId: fileId,
      fileName: fileName,
      offset: offset,
      accepted: accepted,
      error: dictionary["error"] as? String
    ))
  }

  public func session(_ session: MCSession, didReceive stream: InputStream, withName streamName: String, fromPeer peerID: MCPeerID) {
    guard streamName.hasPrefix("\(chunkProtocolName):") else { return }
    DispatchQueue.global(qos: .utility).async {
      self.receiveChunkStream(stream, from: peerID, session: session)
    }
  }

  public func session(_ session: MCSession, didStartReceivingResourceWithName resourceName: String, fromPeer peerID: MCPeerID, with progress: Progress) {
    let transferId = UUID().uuidString
    let observerKey = "\(transferId)-\(resourceName)"
    progressObservers[observerKey] = progress.observe(\.fractionCompleted, options: [.new]) { observedProgress, _ in
      self.sendTransferEvent(
        transferId: transferId,
        peerId: peerID.displayName,
        fileName: resourceName,
        bytesTransferred: Int64(observedProgress.completedUnitCount),
        totalBytes: max(Int64(observedProgress.totalUnitCount), 1),
        status: "in-progress",
        errorMessage: nil
      )
    }
  }

  public func session(_ session: MCSession, didFinishReceivingResourceWithName resourceName: String, fromPeer peerID: MCPeerID, at localURL: URL?, withError error: Error?) {
    let transferId = UUID().uuidString
    if let error {
      sendTransferEvent(
        transferId: transferId,
        peerId: peerID.displayName,
        fileName: resourceName,
        bytesTransferred: 0,
        totalBytes: 1,
        status: "failed",
        errorMessage: error.localizedDescription
      )
      return
    }

    do {
      guard let localURL else {
        throw NSError(domain: "CrossBeamNative", code: 1, userInfo: [NSLocalizedDescriptionKey: "Received file URL was missing"])
      }
      let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
      let crossBeamDirectory = documents.appendingPathComponent("CrossBeam", isDirectory: true)
      try FileManager.default.createDirectory(at: crossBeamDirectory, withIntermediateDirectories: true)
      let destination = uniqueDestination(in: crossBeamDirectory, fileName: resourceName)
      try FileManager.default.moveItem(at: localURL, to: destination)
      let size = (try? FileManager.default.attributesOfItem(atPath: destination.path)[.size] as? NSNumber)?.int64Value ?? 0
      sendTransferEvent(
        transferId: transferId,
        peerId: peerID.displayName,
        fileName: resourceName,
        bytesTransferred: size,
        totalBytes: max(size, 1),
        status: "completed",
        errorMessage: nil
      )
    } catch {
      sendTransferEvent(
        transferId: transferId,
        peerId: peerID.displayName,
        fileName: resourceName,
        bytesTransferred: 0,
        totalBytes: 1,
        status: "failed",
        errorMessage: error.localizedDescription
      )
    }
  }
}

private struct PendingTransfer {
  let id: String
  let peer: MCPeerID
  let files: [PendingFile]
}

private struct ChunkAck {
  let transferId: String
  let fileId: String
  let fileName: String
  let offset: Int64
  let accepted: Bool
  let error: String?
}

private struct TransferCancelledError: Error {}

private struct PendingFile {
  let id: String
  let name: String
  let url: URL
  let sizeBytes: Int64
  let mimeType: String?

  static func from(_ dictionary: [String: Any?]) -> PendingFile? {
    guard
      let id = dictionary["id"] as? String,
      let name = dictionary["name"] as? String,
      let uri = dictionary["uri"] as? String,
      let url = URL(string: uri)
    else {
      return nil
    }

    let sizeBytes = (dictionary["sizeBytes"] as? NSNumber)?.int64Value ?? 0
    return PendingFile(
      id: id,
      name: sanitizeFileName(name),
      url: url,
      sizeBytes: sizeBytes,
      mimeType: dictionary["mimeType"] as? String
    )
  }
}

private func sanitizeFileName(_ name: String) -> String {
  let invalid = CharacterSet(charactersIn: "\\/:*?\"<>|")
  let cleaned = name.components(separatedBy: invalid).joined(separator: "_").trimmingCharacters(in: .whitespacesAndNewlines)
  return cleaned.isEmpty ? "received-file" : cleaned
}

private func uniqueDestination(in directory: URL, fileName: String) -> URL {
  let safeName = sanitizeFileName(fileName)
  var destination = directory.appendingPathComponent(safeName)
  if !FileManager.default.fileExists(atPath: destination.path) {
    return destination
  }

  let ext = destination.pathExtension
  let base = destination.deletingPathExtension().lastPathComponent
  var index = 1
  repeat {
    let candidateName = ext.isEmpty ? "\(base) (\(index))" : "\(base) (\(index)).\(ext)"
    destination = directory.appendingPathComponent(candidateName)
    index += 1
  } while FileManager.default.fileExists(atPath: destination.path)
  return destination
}

private func partialFileSize(_ url: URL) -> Int64 {
  (try? FileManager.default.attributesOfItem(atPath: url.path)[.size] as? NSNumber)?.int64Value ?? 0
}

private func jsonDictionary(from data: Data) throws -> [String: Any]? {
  try JSONSerialization.jsonObject(with: data) as? [String: Any]
}

private func writeJsonLine(_ dictionary: [String: Any], to output: OutputStream) throws {
  var data = try JSONSerialization.data(withJSONObject: dictionary)
  data.append(0x0A)
  try writeData(data, to: output)
}

private func writeData(_ data: Data, to output: OutputStream) throws {
  try data.withUnsafeBytes { rawBuffer in
    guard let baseAddress = rawBuffer.bindMemory(to: UInt8.self).baseAddress else { return }
    var offset = 0
    while offset < data.count {
      let written = output.write(baseAddress.advanced(by: offset), maxLength: data.count - offset)
      if written < 0 {
        throw output.streamError ?? NSError(domain: "CrossBeamNative", code: 13, userInfo: [NSLocalizedDescriptionKey: "Stream write failed"])
      }
      if written == 0 {
        Thread.sleep(forTimeInterval: 0.01)
      } else {
        offset += written
      }
    }
  }
}

private func readLine(from input: InputStream) throws -> Data? {
  var bytes = [UInt8]()
  var byte = UInt8(0)

  while true {
    let count = input.read(&byte, maxLength: 1)
    if count < 0 {
      throw input.streamError ?? NSError(domain: "CrossBeamNative", code: 14, userInfo: [NSLocalizedDescriptionKey: "Stream read failed"])
    }
    if count == 0 {
      return bytes.isEmpty ? nil : Data(bytes)
    }
    if byte == 0x0A {
      return Data(bytes)
    }
    bytes.append(byte)
  }
}

private func readExact(length: Int, from input: InputStream) throws -> Data {
  var data = Data(count: length)
  var offset = 0

  try data.withUnsafeMutableBytes { rawBuffer in
    guard let baseAddress = rawBuffer.bindMemory(to: UInt8.self).baseAddress else { return }
    while offset < length {
      let count = input.read(baseAddress.advanced(by: offset), maxLength: length - offset)
      if count < 0 {
        throw input.streamError ?? NSError(domain: "CrossBeamNative", code: 15, userInfo: [NSLocalizedDescriptionKey: "Stream read failed"])
      }
      if count == 0 {
        throw NSError(domain: "CrossBeamNative", code: 16, userInfo: [NSLocalizedDescriptionKey: "Stream ended during chunk read"])
      }
      offset += count
    }
  }

  return data
}

private func sendChunkAck(session: MCSession, peerID: MCPeerID, transferId: String, fileId: String, fileName: String, offset: Int64, accepted: Bool, error: String?) throws {
  var payload: [String: Any] = [
    "type": "chunkAck",
    "transferId": transferId,
    "fileId": fileId,
    "fileName": fileName,
    "offset": offset,
    "accepted": accepted
  ]
  if let error {
    payload["error"] = error
  }
  let data = try JSONSerialization.data(withJSONObject: payload)
  try session.send(data, toPeers: [peerID], with: .reliable)
}

private func sha256Data(_ data: Data) -> String {
  SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
}

private func sha256File(_ url: URL) throws -> String {
  let handle = try FileHandle(forReadingFrom: url)
  defer { try? handle.close() }

  var hasher = SHA256()
  while true {
    let data = handle.readData(ofLength: 1024 * 1024)
    if data.isEmpty {
      break
    }
    hasher.update(data: data)
  }

  return hasher.finalize().map { String(format: "%02x", $0) }.joined()
}
