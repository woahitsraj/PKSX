import GameController
import UIKit
import WebKit
import XCTest

@MainActor
final class ControllerNavigationTests: XCTestCase {
    private var controller: GCController!

    override func setUp() async throws {
        continueAfterFailure = false
        controller = GCController.withExtendedGamepad()
    }

    func testControllerNavigatesAndHighlightsSlotActions() async throws {
        let webView = try await controllerSurface()
        controller.extendedGamepad?.dpad.setValueForXAxis(1, yAxis: 0)
        try await waitForJavaScript("document.activeElement?.id === 'box-0-slot-1'", in: webView)
        controller.extendedGamepad?.dpad.setValueForXAxis(0, yAxis: 0)

        controller.extendedGamepad?.buttonA.setValue(1)
        try await waitForJavaScript(
            "document.querySelector('[role=\"dialog\"][aria-label=\"Slot actions\"]') !== null && document.activeElement?.id === 'slot-action-0'",
            in: webView
        )
        controller.extendedGamepad?.buttonA.setValue(0)

        controller.extendedGamepad?.dpad.setValueForXAxis(0, yAxis: -1)
        try await waitForJavaScript(
            "document.activeElement?.id === 'slot-action-1' && document.activeElement.classList.contains('controller-focused') && getComputedStyle(document.activeElement).outlineStyle === 'solid'",
            in: webView
        )
        controller.extendedGamepad?.dpad.setValueForXAxis(0, yAxis: 0)

        controller.extendedGamepad?.buttonB.setValue(1)
        try await waitForJavaScript(
            "document.querySelector('[role=\"dialog\"][aria-label=\"Slot actions\"]') === null && document.activeElement?.id === 'box-0-slot-1'",
            in: webView
        )
    }

    func testJoystickAndShortcutButtonsFollowKeyboardNavigation() async throws {
        let webView = try await controllerSurface()

        controller.extendedGamepad?.leftThumbstick.setValueForXAxis(1, yAxis: 0)
        try await waitForJavaScript("document.activeElement?.id === 'box-0-slot-1'", in: webView)
        controller.extendedGamepad?.leftThumbstick.setValueForXAxis(0, yAxis: 0)

        controller.extendedGamepad?.buttonY.setValue(1)
        try await waitForJavaScript(
            "document.querySelector('[role=\"dialog\"][aria-label=\"Add Box Source\"]') !== null && document.activeElement?.classList.contains('source-card') && getComputedStyle(document.activeElement).outlineStyle === 'solid'",
            in: webView
        )
        controller.extendedGamepad?.buttonY.setValue(0)

        controller.extendedGamepad?.buttonB.setValue(1)
        try await waitForJavaScript(
            "document.querySelector('[role=\"dialog\"][aria-label=\"Add Box Source\"]') === null",
            in: webView
        )
        controller.extendedGamepad?.buttonB.setValue(0)

        controller.extendedGamepad?.rightShoulder.setValue(1)
        try await waitForJavaScript(
            "document.querySelector('.box-title h2')?.textContent?.includes('Box 02')",
            in: webView
        )
        controller.extendedGamepad?.rightShoulder.setValue(0)

        controller.extendedGamepad?.leftShoulder.setValue(1)
        try await waitForJavaScript(
            "document.querySelector('.box-title h2')?.textContent?.includes('Box 01')",
            in: webView
        )
    }

    func testPhoneWidthUsesMobileShell() async throws {
        let webView = try appWebView()
        try await waitForJavaScript(
            "innerWidth <= 1024 && getComputedStyle(document.querySelector('.mobile-tabbar')).display !== 'none' && getComputedStyle(document.querySelector('.box-sidebar')).display === 'none'",
            in: webView
        )
    }

    private func controllerSurface() async throws -> WKWebView {
        let webView = try appWebView()
        try await waitForJavaScript(
            "document.readyState === 'complete' && document.querySelector('#box-grid')?.getClientRects().length > 0",
            in: webView
        )
        _ = try await webView.evaluateJavaScript("document.querySelector('#box-grid').focus()")
        _ = try await webView.evaluateJavaScript(
            "window.__pksxControllerConnected = false; window.addEventListener('pksxcontrollerconnection', () => window.__pksxControllerConnected = true, { once: true })"
        )
        NotificationCenter.default.post(name: .GCControllerDidConnect, object: controller)
        try await waitForJavaScript("window.__pksxControllerConnected === true", in: webView)
        return webView
    }

    private func appWebView() throws -> WKWebView {
        let windows = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
        return try XCTUnwrap(
            windows.lazy.compactMap(findWebView).first,
            "The app WebView is unavailable"
        )
    }

    private func findWebView(in view: UIView) -> WKWebView? {
        if let webView = view as? WKWebView {
            return webView
        }
        return view.subviews.lazy.compactMap(findWebView).first
    }

    private func waitForJavaScript(
        _ script: String,
        in webView: WKWebView,
        timeout: TimeInterval = 20
    ) async throws {
        let deadline = Date().addingTimeInterval(timeout)
        while Date() < deadline {
            if (try? await webView.evaluateJavaScript(script)) as? Bool == true {
                return
            }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        XCTFail("Timed out waiting for JavaScript: \(script)")
    }
}
