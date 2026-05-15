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
      throw Exception(
        name: "TransferUnavailable",
        description: "Native iOS MCSession transfer needs a connected authenticated peer before files can be sent."
      )
    }

    AsyncFunction("cancelTransfer") { (_ transferId: String) in
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
    sendEvent("onPeerFound", peer)
  }

  public func browser(_ browser: MCNearbyServiceBrowser, lostPeer peerID: MCPeerID) {
    peers.removeValue(forKey: peerID.displayName)
    sendEvent("onPeerLost", ["id": peerID.displayName])
  }

  public func browser(_ browser: MCNearbyServiceBrowser, didNotStartBrowsingForPeers error: Error) {}
}

extension CrossBeamNativeModule: MCNearbyServiceAdvertiserDelegate {
  public func advertiser(_ advertiser: MCNearbyServiceAdvertiser, didReceiveInvitationFromPeer peerID: MCPeerID, withContext context: Data?, invitationHandler: @escaping (Bool, MCSession?) -> Void) {
    invitationHandler(false, session)
  }

  public func advertiser(_ advertiser: MCNearbyServiceAdvertiser, didNotStartAdvertisingPeer error: Error) {}
}
