import AppKit
import Darwin
import Foundation
import Network

final class StatusItemController: NSObject, NSApplicationDelegate {
  private let iconPath: String
  private let socketPath: String
  private let parentPid: Int32
  private var statusItem: NSStatusItem?
  private var updateLabel: String?
  private var updateEnabled = false
  private var inputBuffer = ""
  private var parentTimer: Timer?
  private var connection: NWConnection?

  init(iconPath: String, socketPath: String, parentPid: Int32) {
    self.iconPath = iconPath
    self.socketPath = socketPath
    self.parentPid = parentPid
  }

  func applicationDidFinishLaunching(_ notification: Notification) {
    NSApp.setActivationPolicy(.accessory)

    guard let image = NSImage(contentsOfFile: iconPath) else {
      FileHandle.standardError.write(Data("Unable to load status icon: \(iconPath)\n".utf8))
      NSApp.terminate(nil)
      return
    }

    image.isTemplate = true
    image.size = NSSize(width: 22, height: 22)

    let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    statusItem = item
    if let button = item.button {
      button.image = image
      button.imageScaling = .scaleProportionallyUpOrDown
      button.toolTip = "dachshund"
      button.target = self
      button.action = #selector(statusButtonPressed(_:))
      button.sendAction(on: [.leftMouseDown, .rightMouseDown])
    }

    connectToApp()
    parentTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
      guard let self, self.parentPid > 0 else { return }
      if kill(self.parentPid, 0) != 0 {
        NSApp.terminate(nil)
      }
    }

    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
      self.emitBounds(for: item.button?.window)
    }
  }

  @objc private func statusButtonPressed(_ sender: Any?) {
    if NSApp.currentEvent?.type == .rightMouseDown {
      showMenu()
      return
    }

    emitBounds(for: NSApp.currentEvent?.window)
    send(["event": "toggle"])
  }

  private func showMenu() {
    guard let item = statusItem else { return }
    let menu = NSMenu()

    addMenuItem(to: menu, title: "Open compact panel", action: #selector(openPanel))
    addMenuItem(to: menu, title: "Open dachshund", action: #selector(openDachshund))
    addMenuItem(to: menu, title: "New memory", action: #selector(newMemory))
    addMenuItem(to: menu, title: "Scan agents", action: #selector(scanAgents))
    addMenuItem(to: menu, title: "Check for updates", action: #selector(checkForUpdates))

    if let updateLabel {
      menu.addItem(.separator())
      let updateItem = addMenuItem(
        to: menu,
        title: updateLabel,
        action: #selector(downloadUpdate)
      )
      updateItem.isEnabled = updateEnabled
    }

    menu.addItem(.separator())
    addMenuItem(to: menu, title: "Quit dachshund", action: #selector(quitApp))
    item.popUpMenu(menu)
  }

  @discardableResult
  private func addMenuItem(to menu: NSMenu, title: String, action: Selector) -> NSMenuItem {
    let item = NSMenuItem(title: title, action: action, keyEquivalent: "")
    item.target = self
    menu.addItem(item)
    return item
  }

  @objc private func openPanel() {
    send(["event": "command", "command": "show_panel"])
  }

  @objc private func openDachshund() {
    send(["event": "command", "command": "show_window"])
  }

  @objc private func newMemory() {
    send(["event": "command", "command": "new_memory"])
  }

  @objc private func scanAgents() {
    send(["event": "command", "command": "scan_agents"])
  }

  @objc private func checkForUpdates() {
    send(["event": "command", "command": "check_updates"])
  }

  @objc private func downloadUpdate() {
    send(["event": "command", "command": "download_update"])
  }

  @objc private func quitApp() {
    send(["event": "command", "command": "quit"])
  }

  private func connectToApp() {
    let connection = NWConnection(to: .unix(path: socketPath), using: .tcp)
    self.connection = connection
    connection.stateUpdateHandler = { [weak self] state in
      switch state {
      case .ready:
        self?.receiveFromApp()
        self?.emitBounds(for: self?.statusItem?.button?.window)
      case .failed, .cancelled:
        NSApp.terminate(nil)
      default:
        break
      }
    }
    connection.start(queue: .main)
  }

  private func receiveFromApp() {
    connection?.receive(minimumIncompleteLength: 1, maximumLength: 65536) {
      [weak self] data, _, isComplete, error in
      DispatchQueue.main.async {
        guard let self else { return }
        if let data, !data.isEmpty, let chunk = String(data: data, encoding: .utf8) {
          self.consume(chunk)
        }
        if isComplete || error != nil {
          NSApp.terminate(nil)
          return
        }
        self.receiveFromApp()
      }
    }
  }

  private func consume(_ chunk: String) {
    inputBuffer += chunk
    while let newline = inputBuffer.firstIndex(of: "\n") {
      let line = String(inputBuffer[..<newline])
      inputBuffer = String(inputBuffer[inputBuffer.index(after: newline)...])
      handleCommand(line)
    }
  }

  private func handleCommand(_ line: String) {
    guard
      !line.isEmpty,
      let data = line.data(using: .utf8),
      let payload = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    else {
      return
    }

    guard payload["type"] as? String == "update" else { return }
    updateLabel = payload["label"] as? String
    updateEnabled = payload["enabled"] as? Bool ?? false
  }

  private func emitBounds(for window: NSWindow?) {
    guard let frame = window?.frame else { return }
    let mainScreenMaxY = NSScreen.screens.first?.frame.maxY ?? frame.maxY
    send([
      "event": "bounds",
      "bounds": [
        "x": frame.origin.x,
        "y": mainScreenMaxY - frame.maxY,
        "width": frame.width,
        "height": frame.height
      ]
    ])
  }

  private func send(_ payload: [String: Any]) {
    guard
      let data = try? JSONSerialization.data(withJSONObject: payload),
      var line = String(data: data, encoding: .utf8)
    else {
      return
    }
    line += "\n"
    connection?.send(
      content: Data(line.utf8),
      completion: .contentProcessed { error in
        if error != nil {
          NSApp.terminate(nil)
        }
      }
    )
  }
}

let arguments = CommandLine.arguments
guard
  arguments.count >= 4,
  let parentPid = Int32(arguments[3])
else {
  FileHandle.standardError.write(
    Data("Usage: dachshund-status <icon> <socket-path> <parent-pid>\n".utf8)
  )
  exit(2)
}

let application = NSApplication.shared
let controller = StatusItemController(
  iconPath: arguments[1],
  socketPath: arguments[2],
  parentPid: parentPid
)
application.delegate = controller
application.run()
