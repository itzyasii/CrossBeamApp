import ExpoModulesCore
import MultipeerConnectivity
import UIKit

public final class CrossBeamNativeModule: Module {
  private let serviceType = "crossbeam"
  private var peerId: MCPeerID?
  private var session: MCSession?
  private var advertiser: MCNearbyServiceAdvertiser?
  private var browser: MCNearbyServiceBrowser?
  private var peers: [String: [String: Any?]] = [:]
  private var peerIds: [String: MCPeerID] = [:]
  private var pendingTransfersByPeer: [String: PendingTransfer] = [:]
  private var progressObservers: [String: NSKeyValueObservation] = [:]
  private var transferProgress: [String: [Progress]] = [:]

  public func definition() -> ModuleDefinition {
    Name("CrossBeamNative")

    Events("onPeerFound", "onPeerLost", "onTransferProgress")

    AsyncFunction("isAvailable") {
      return true
    }

    AsyncFunction("getPlatformCapabilities") {
      return ["multipeer-discovery", "multipeer-resource-transfer"]
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
      throw Exception(
        name: "PauseUnavailable",
        description: "MCSession resource transfers do not expose arbitrary pause/resume controls."
      )
    }

    AsyncFunction("resumeTransfer") { (_ transferId: String) in
      throw Exception(
        name: "ResumeUnavailable",
        description: "Resume requires app-managed chunk checkpoints over a custom stream protocol."
      )
    }
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
    guard let session else { return }
    let totalBytes = transfer.files.reduce(0) { $0 + $1.sizeBytes }
    var completedBytes: Int64 = 0

    for file in transfer.files {
      let progress = session.sendResource(at: file.url, withName: file.name, toPeer: transfer.peer) { error in
        if let error {
          self.sendTransferEvent(
            transferId: transfer.id,
            peerId: transfer.peer.displayName,
            fileName: file.name,
            bytesTransferred: completedBytes,
            totalBytes: max(totalBytes, 1),
            status: "failed",
            errorMessage: error.localizedDescription
          )
          return
        }

        completedBytes += file.sizeBytes
        let status = completedBytes >= totalBytes ? "completed" : "in-progress"
        self.sendTransferEvent(
          transferId: transfer.id,
          peerId: transfer.peer.displayName,
          fileName: file.name,
          bytesTransferred: completedBytes,
          totalBytes: max(totalBytes, 1),
          status: status,
          errorMessage: nil
        )
      }

      if let progress {
        transferProgress[transfer.id, default: []].append(progress)
        let observerKey = "\(transfer.id)-\(file.name)"
        progressObservers[observerKey] = progress.observe(\.fractionCompleted, options: [.new]) { observedProgress, _ in
          let fileBytes = Int64(Double(file.sizeBytes) * observedProgress.fractionCompleted)
          self.sendTransferEvent(
            transferId: transfer.id,
            peerId: transfer.peer.displayName,
            fileName: file.name,
            bytesTransferred: min(completedBytes + fileBytes, totalBytes),
            totalBytes: max(totalBytes, 1),
            status: "in-progress",
            errorMessage: nil
          )
        }
      }
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

  public func session(_ session: MCSession, didReceive data: Data, fromPeer peerID: MCPeerID) {}

  public func session(_ session: MCSession, didReceive stream: InputStream, withName streamName: String, fromPeer peerID: MCPeerID) {}

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
