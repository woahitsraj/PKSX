package com.pksx.app;

import static org.junit.Assert.fail;
import static org.junit.Assume.assumeTrue;

import android.content.pm.PackageInfo;
import android.graphics.Rect;
import android.graphics.RectF;
import android.os.SystemClock;
import android.util.Log;
import android.view.InputDevice;
import android.view.KeyCharacterMap;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.util.Base64;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.test.ext.junit.rules.ActivityScenarioRule;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.Locale;
import org.json.JSONArray;
import org.junit.Rule;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class ControllerNavigationTest {
    private static final long TIMEOUT_SECONDS = 20;
    private static final long ENGINE_TIMEOUT_SECONDS = 60;

    @Rule
    public ActivityScenarioRule<MainActivity> activityRule =
        new ActivityScenarioRule<>(MainActivity.class);

    @Test
    public void gamepadNavigatesAndHighlightsSlotActions() throws Exception {
        awaitControllerSurface();
        runJavaScript(
            "window.__pksxTestControllerEvents = [];"
                + " window.addEventListener('pksxcontroller', event =>"
                + " window.__pksxTestControllerEvents.push(event.detail.key + ':' + event.detail.pressed));"
                + " document.querySelector('#box-grid').focus()"
        );

        pressGamepadKey(
            KeyEvent.KEYCODE_DPAD_RIGHT,
            "window.__pksxTestControllerEvents?.includes('ArrowRight:true')"
                + " && document.activeElement?.id === 'box-0-slot-1'"
        );

        pressGamepadKey(
            KeyEvent.KEYCODE_BUTTON_A,
            "document.querySelector('[role=\"dialog\"][aria-label=\"Slot actions\"]') !== null"
                + " && document.activeElement?.id === 'slot-action-0'"
        );

        pressGamepadKey(
            KeyEvent.KEYCODE_DPAD_DOWN,
            "document.activeElement?.id === 'slot-action-1'"
                + " && document.activeElement.classList.contains('controller-focused')"
                + " && getComputedStyle(document.activeElement).outlineStyle === 'solid'"
        );

        pressGamepadKey(
            KeyEvent.KEYCODE_BUTTON_B,
            "document.querySelector('[role=\"dialog\"][aria-label=\"Slot actions\"]') === null"
                + " && document.activeElement?.id === 'box-0-slot-1'"
        );
    }

    @Test
    public void joystickAndShortcutButtonsFollowKeyboardNavigation() throws Exception {
        awaitControllerSurface();
        runJavaScript("document.querySelector('#box-grid').focus()");

        moveJoystick(1f, 0f, "document.activeElement?.id === 'box-0-slot-1'");

        pressGamepadKey(
            KeyEvent.KEYCODE_BUTTON_Y,
            "document.querySelector('[role=\"dialog\"][aria-label=\"Add Box Source\"]') !== null"
                + " && document.activeElement?.classList.contains('source-card')"
                + " && getComputedStyle(document.activeElement).outlineStyle === 'solid'"
        );

        pressGamepadKey(
            KeyEvent.KEYCODE_BUTTON_B,
            "document.querySelector('[role=\"dialog\"][aria-label=\"Add Box Source\"]') === null"
        );

        pressGamepadKey(
            KeyEvent.KEYCODE_BUTTON_R1,
            "document.querySelector('.box-title h2')?.textContent?.includes('Box 02')"
        );

        pressGamepadKey(
            KeyEvent.KEYCODE_BUTTON_L1,
            "document.querySelector('.box-title h2')?.textContent?.includes('Box 01')"
        );
    }

    @Test
    public void smallWidescreenUsesMobileShell() throws Exception {
        awaitJavaScript(
            "innerWidth <= 1024"
                + " && innerWidth > innerHeight"
                + " && getComputedStyle(document.querySelector('.mobile-tabbar')).display !== 'none'"
                + " && getComputedStyle(document.querySelector('.box-sidebar')).display === 'none'"
        );
    }

    @Test
    public void syntheticSafeAreaInsetsControlShellPadding() throws Exception {
        awaitJavaScript("document.readyState === 'complete' && document.querySelector('.app-shell')");
        awaitJavaScript(
            "(() => {"
                + " const root = document.documentElement;"
                + " const sides = ['top', 'right', 'bottom', 'left'];"
                + " const previous = sides.map(side => root.style.getPropertyValue('--safe-area-inset-' + side));"
                + " ['20px', '21px', '22px', '23px'].forEach((value, index) =>"
                + " root.style.setProperty('--safe-area-inset-' + sides[index], value));"
                + " const shell = getComputedStyle(document.querySelector('.app-shell'));"
                + " const tabbar = getComputedStyle(document.querySelector('.mobile-tabbar'));"
                + " const matches = shell.paddingTop === '20px' && shell.paddingRight === '21px'"
                + " && shell.paddingBottom === '100px' && shell.paddingLeft === '23px'"
                + " && tabbar.paddingBottom === '28px';"
                + " sides.forEach((side, index) => previous[index]"
                + " ? root.style.setProperty('--safe-area-inset-' + side, previous[index])"
                + " : root.style.removeProperty('--safe-area-inset-' + side));"
                + " return matches;"
                + " })()"
        );
    }

    @Test
    public void pre140WebViewKeepsShellContentInsideSystemBars() throws Exception {
        PackageInfo webViewPackage = WebView.getCurrentWebViewPackage();
        String provider = webViewPackage == null ? "unknown" : webViewPackage.packageName;
        String version = webViewPackage == null ? "unknown" : webViewPackage.versionName;
        assumeTrue(
            "Requires Android WebView below 140, actual provider: " + provider + " " + version,
            webViewPackage != null && Integer.parseInt(version.split("\\.")[0]) < 140
        );
        awaitJavaScript(
            "document.readyState === 'complete'"
                + " && document.querySelector('.app-shell') !== null"
                + " && document.querySelector('.top-bar') !== null"
                + " && document.querySelector('#mobile-tab-0') !== null"
        );

        JSONArray geometry = new JSONArray(
            runJavaScript(
                "(() => {"
                    + " const topBar = document.querySelector('.top-bar').getBoundingClientRect();"
                    + " const firstTab = document.querySelector('#mobile-tab-0').getBoundingClientRect();"
                    + " const root = getComputedStyle(document.documentElement);"
                    + " return [innerWidth, innerHeight, topBar.left, topBar.top, topBar.right, topBar.bottom,"
                    + " firstTab.left, firstTab.top, firstTab.right, firstTab.bottom,"
                    + " root.getPropertyValue('--safe-area-inset-top'),"
                    + " root.getPropertyValue('--safe-area-inset-right'),"
                    + " root.getPropertyValue('--safe-area-inset-bottom'),"
                    + " root.getPropertyValue('--safe-area-inset-left')];"
                    + " })()"
            )
        );
        double innerWidth = geometry.getDouble(0);
        double innerHeight = geometry.getDouble(1);
        double[] topBarCss = {
            geometry.getDouble(2),
            geometry.getDouble(3),
            geometry.getDouble(4),
            geometry.getDouble(5)
        };
        double[] firstTabCss = {
            geometry.getDouble(6),
            geometry.getDouble(7),
            geometry.getDouble(8),
            geometry.getDouble(9)
        };
        AtomicReference<Boolean> barsAvailable = new AtomicReference<>(false);
        AtomicReference<Boolean> contentContained = new AtomicReference<>(false);
        AtomicReference<String> evidence = new AtomicReference<>();
        activityRule
            .getScenario()
            .onActivity(
                activity -> {
                    WebView webView = activity.getBridge().getWebView();
                    int[] webViewOrigin = new int[2];
                    int[] decorOrigin = new int[2];
                    webView.getLocationOnScreen(webViewOrigin);
                    activity.getWindow().getDecorView().getLocationOnScreen(decorOrigin);
                    Rect decorBounds = new Rect(
                        decorOrigin[0],
                        decorOrigin[1],
                        decorOrigin[0] + activity.getWindow().getDecorView().getWidth(),
                        decorOrigin[1] + activity.getWindow().getDecorView().getHeight()
                    );
                    Rect webViewBounds = new Rect(
                        webViewOrigin[0],
                        webViewOrigin[1],
                        webViewOrigin[0] + webView.getWidth(),
                        webViewOrigin[1] + webView.getHeight()
                    );
                    WindowInsetsCompat windowInsets = ViewCompat.getRootWindowInsets(
                        activity.getWindow().getDecorView()
                    );
                    Insets systemBars = windowInsets == null
                        ? Insets.NONE
                        : windowInsets.getInsets(
                            WindowInsetsCompat.Type.systemBars() |
                            WindowInsetsCompat.Type.displayCutout()
                        );
                    Rect safeBounds = new Rect(
                        decorBounds.left + systemBars.left,
                        decorBounds.top + systemBars.top,
                        decorBounds.right - systemBars.right,
                        decorBounds.bottom - systemBars.bottom
                    );
                    double scaleX = webView.getWidth() / innerWidth;
                    double scaleY = webView.getHeight() / innerHeight;
                    RectF topBarBounds = screenBounds(webViewOrigin, scaleX, scaleY, topBarCss);
                    RectF firstTabBounds = screenBounds(webViewOrigin, scaleX, scaleY, firstTabCss);
                    barsAvailable.set(systemBars.top > 0 && systemBars.bottom > 0);
                    contentContained.set(
                        scaleX > 0 &&
                        scaleY > 0 &&
                        contains(safeBounds, topBarBounds) &&
                        contains(safeBounds, firstTabBounds)
                    );
                    evidence.set(
                        String.format(
                            Locale.US,
                            "provider=%s %s decor=%s webView=%s bars=%s safe=%s scale=%.3fx%.3f topBar=%s firstTab=%s cssVars=%s",
                            provider,
                            version,
                            decorBounds,
                            webViewBounds,
                            systemBars,
                            safeBounds,
                            scaleX,
                            scaleY,
                            topBarBounds,
                            firstTabBounds,
                            geometry.toString()
                        )
                    );
                }
            );
        assumeTrue(
            "Requires visible top and bottom system bars. " + evidence.get(),
            barsAvailable.get()
        );
        Log.i("PKSXAcceptance", evidence.get());
        if (!contentContained.get()) fail("Safe-area containment failed. " + evidence.get());
    }

    @Test
    public void controllerHighlightSurvivesRepeatedTopAndBottomNavigation() throws Exception {
        awaitControllerSurface();
        runJavaScript("document.querySelector('#box-grid').focus()");

        for (int row = 0; row < 5; row++) {
            pressGamepadKey(KeyEvent.KEYCODE_DPAD_DOWN, null);
        }
        awaitControllerHighlight("mobile-tab-1");

        for (int interaction = 0; interaction < 20; interaction++) {
            int keyCode = interaction % 2 == 0
                ? KeyEvent.KEYCODE_DPAD_LEFT
                : KeyEvent.KEYCODE_DPAD_RIGHT;
            String expectedId = interaction % 2 == 0 ? "mobile-tab-0" : "mobile-tab-1";
            pressGamepadKey(keyCode, controllerHighlightExpression(expectedId));
        }

        pressGamepadKey(
            KeyEvent.KEYCODE_BUTTON_A,
            "location.pathname.endsWith('/save-file') && "
                + controllerHighlightExpression("mobile-tab-1")
        );
        SystemClock.sleep(1000);
        awaitControllerHighlight("mobile-tab-1");
        pressGamepadKey(
            KeyEvent.KEYCODE_DPAD_RIGHT,
            controllerHighlightExpression("mobile-tab-2")
        );
        pressGamepadKey(
            KeyEvent.KEYCODE_BUTTON_A,
            "location.pathname.endsWith('/saves') && "
                + controllerHighlightExpression("mobile-tab-2")
        );
        pressGamepadKey(
            KeyEvent.KEYCODE_DPAD_LEFT,
            controllerHighlightExpression("mobile-tab-1")
        );
        pressGamepadKey(
            KeyEvent.KEYCODE_DPAD_LEFT,
            controllerHighlightExpression("mobile-tab-0")
        );
        pressGamepadKey(
            KeyEvent.KEYCODE_BUTTON_A,
            "location.pathname === '/' && " + controllerHighlightExpression("mobile-tab-0")
        );

        runJavaScript("document.querySelector('#top-control-4').focus()");
        awaitControllerHighlight("top-control-4");

        for (int interaction = 0; interaction < 20; interaction++) {
            int keyCode = interaction % 2 == 0
                ? KeyEvent.KEYCODE_DPAD_RIGHT
                : KeyEvent.KEYCODE_DPAD_LEFT;
            String expectedId = interaction % 2 == 0 ? "top-control-6" : "top-control-4";
            pressGamepadKey(keyCode, controllerHighlightExpression(expectedId));
        }

        SystemClock.sleep(1000);
        awaitControllerHighlight("top-control-4");
    }

    @Test
    public void controllerFrameworkHighlightsContextEditorAndEveryFocusableControl()
        throws Exception {
        awaitControllerSurface();
        importEmeraldSave();
        runJavaScript("document.querySelector('#mobile-tab-0').click()");
        awaitControllerSurface();
        awaitJavaScript("document.querySelector('#box-0-slot-0')?.textContent.includes('ARON')");
        runJavaScript("document.querySelector('#box-grid').focus()");

        pressGamepadKey(
            KeyEvent.KEYCODE_BUTTON_A,
            "document.querySelector('[aria-label=\"Slot actions\"]') !== null"
        );
        assertAllFocusableControlsHighlighted("[aria-label=\"Slot actions\"]");
        runJavaScript("document.querySelector('#slot-action-0').focus()");
        pressGamepadKey(
            KeyEvent.KEYCODE_BUTTON_A,
            "document.querySelector('.pokemon-editor') !== null"
        );
        runJavaScript("document.querySelector('#pokemon-editor-nickname').focus()");
        pressGamepadKey(
            KeyEvent.KEYCODE_BUTTON_Y,
            controllerHighlightExpression("pokemon-editor-nickname")
        );
        assertAllFocusableControlsHighlighted(".pokemon-editor");
    }

    @Test
    public void controllerFrameworkNavigatesAndHighlightsSaveScreens() throws Exception {
        awaitControllerSurface();
        importEmeraldSave();
        runJavaScript("document.querySelector('#mobile-tab-1').click()");
        awaitJavaScript("location.pathname.endsWith('/save-file')");

        awaitJavaScript("document.querySelector('.field-sidebar nav button') !== null");
        runJavaScript("document.querySelector('.field-sidebar nav button').focus()");
        pressGamepadKey(
            KeyEvent.KEYCODE_DPAD_DOWN,
            "document.activeElement !== document.querySelector('.field-sidebar nav button')"
                + " && document.activeElement?.closest('.save-file-route') !== null"
                + " && getComputedStyle(document.activeElement).outlineStyle === 'solid'"
        );
        assertAllFocusableControlsHighlighted(".save-file-route");

        runJavaScript("document.querySelector('#mobile-tab-2').click()");
        awaitJavaScript("location.pathname.endsWith('/saves')");
        runJavaScript("document.querySelector('[data-saves-control]').focus()");
        pressGamepadKey(
            KeyEvent.KEYCODE_DPAD_DOWN,
            "document.activeElement?.hasAttribute('data-saves-control')"
                + " && getComputedStyle(document.activeElement).outlineStyle === 'solid'"
        );
        assertAllFocusableControlsHighlighted(".saves-page");
    }

    private void awaitControllerSurface() throws Exception {
        awaitJavaScript(
            "document.readyState === 'complete'"
                + " && document.querySelector('#box-grid')?.getClientRects().length > 0"
        );
        InstrumentationRegistry.getInstrumentation().waitForIdleSync();
        SystemClock.sleep(500);
    }

    private RectF screenBounds(int[] origin, double scaleX, double scaleY, double[] cssBounds) {
        return new RectF(
            (float) (origin[0] + cssBounds[0] * scaleX),
            (float) (origin[1] + cssBounds[1] * scaleY),
            (float) (origin[0] + cssBounds[2] * scaleX),
            (float) (origin[1] + cssBounds[3] * scaleY)
        );
    }

    private boolean contains(Rect outer, RectF inner) {
        return inner.left >= outer.left - 1 &&
        inner.top >= outer.top - 1 &&
        inner.right <= outer.right + 1 &&
        inner.bottom <= outer.bottom + 1;
    }

    private void pressGamepadKey(int keyCode, String expectedState) throws Exception {
        long downTime = SystemClock.uptimeMillis();
        dispatchKeyEvent(
            new KeyEvent(
                downTime,
                downTime,
                KeyEvent.ACTION_DOWN,
                keyCode,
                0,
                0,
                KeyCharacterMap.VIRTUAL_KEYBOARD,
                0,
                0,
                InputDevice.SOURCE_GAMEPAD
            )
        );
        if (expectedState != null) awaitJavaScript(expectedState);
        dispatchKeyEvent(
            new KeyEvent(
                downTime,
                SystemClock.uptimeMillis(),
                KeyEvent.ACTION_UP,
                keyCode,
                0,
                0,
                KeyCharacterMap.VIRTUAL_KEYBOARD,
                0,
                0,
                InputDevice.SOURCE_GAMEPAD
            )
        );
        runJavaScript("true");
    }

    private void awaitControllerHighlight(String id) throws Exception {
        awaitJavaScript(controllerHighlightExpression(id));
    }

    private String controllerHighlightExpression(String id) {
        return "document.activeElement?.id === '"
            + id
            + "' && getComputedStyle(document.activeElement).outlineStyle === 'solid'"
            + " && parseFloat(getComputedStyle(document.activeElement).outlineWidth) >= 3";
    }

    private void assertAllFocusableControlsHighlighted(String scope) throws Exception {
        String selector =
            "button:not([disabled]),a[href],input:not([disabled]):not([type=hidden]):not([type=file]),"
                + "select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex=\"-1\"])";
        awaitJavaScript(
            "(() => { const root = document.querySelector('"
                + scope
                + "'); if (!root) return false; const controls = [...root.querySelectorAll('"
                + selector
                + "')].filter(control => { const rect = control.getBoundingClientRect();"
                + " const style = getComputedStyle(control); return rect.width > 0 && rect.height > 0"
                + " && style.display !== 'none' && style.visibility !== 'hidden'; });"
                + " return controls.length > 0 && controls.every(control => { control.focus();"
                + " const style = getComputedStyle(control); return style.outlineStyle === 'solid'"
                + " && parseFloat(style.outlineWidth) >= 3; }); })()"
        );
    }

    private void importEmeraldSave() throws Exception {
        runJavaScript("document.querySelector('#mobile-tab-2').click()");
        awaitJavaScript(
            "location.pathname.endsWith('/saves') && document.querySelector('#save-file-input')"
        );
        String encoded = Base64.encodeToString(readAsset("emerald-011020251345.sav"), Base64.NO_WRAP);
        runJavaScript(
            "(() => { const bytes = Uint8Array.from(atob('"
                + encoded
                + "'), value => value.charCodeAt(0)); const transfer = new DataTransfer();"
                + " transfer.items.add(new File([bytes], 'emerald.sav'));"
                + " const input = document.querySelector('#save-file-input'); input.files = transfer.files;"
                + " input.dispatchEvent(new Event('change', { bubbles: true })); return true; })()"
        );
        awaitJavaScript(
            "document.body.textContent.includes('emerald.sav imported and made active.')",
            ENGINE_TIMEOUT_SECONDS
        );
    }

    private byte[] readAsset(String name) throws Exception {
        try (
            InputStream input = InstrumentationRegistry
                .getInstrumentation()
                .getContext()
                .getAssets()
                .open(name);
            ByteArrayOutputStream output = new ByteArrayOutputStream()
        ) {
            byte[] buffer = new byte[8192];
            int read;
            while ((read = input.read(buffer)) != -1) output.write(buffer, 0, read);
            return output.toByteArray();
        }
    }

    private void dispatchKeyEvent(KeyEvent event) {
        activityRule.getScenario().onActivity(activity -> activity.dispatchKeyEvent(event));
    }

    private void moveJoystick(float x, float y, String expectedState) throws Exception {
        dispatchJoystickMotion(x, y);
        awaitJavaScript(expectedState);
        dispatchJoystickMotion(0f, 0f);
        runJavaScript("true");
    }

    private void dispatchJoystickMotion(float x, float y) {
        MotionEvent.PointerProperties properties = new MotionEvent.PointerProperties();
        properties.id = 0;
        properties.toolType = MotionEvent.TOOL_TYPE_UNKNOWN;

        MotionEvent.PointerCoords coordinates = new MotionEvent.PointerCoords();
        coordinates.setAxisValue(MotionEvent.AXIS_X, x);
        coordinates.setAxisValue(MotionEvent.AXIS_Y, y);

        long eventTime = SystemClock.uptimeMillis();
        MotionEvent event =
            MotionEvent.obtain(
                eventTime,
                eventTime,
                MotionEvent.ACTION_MOVE,
                1,
                new MotionEvent.PointerProperties[] { properties },
                new MotionEvent.PointerCoords[] { coordinates },
                0,
                0,
                1f,
                1f,
                0,
                0,
                InputDevice.SOURCE_JOYSTICK,
                0
            );
        activityRule
            .getScenario()
            .onActivity(activity -> activity.dispatchGenericMotionEvent(event));
        event.recycle();
    }

    private void awaitJavaScript(String expression) throws Exception {
        awaitJavaScript(expression, TIMEOUT_SECONDS);
    }

    private void awaitJavaScript(String expression, long timeoutSeconds) throws Exception {
        long deadline = SystemClock.uptimeMillis() + TimeUnit.SECONDS.toMillis(timeoutSeconds);
        String result = null;

        while (SystemClock.uptimeMillis() < deadline) {
            result = runJavaScript("Boolean(" + expression + ")");
            if ("true".equals(result)) return;
            SystemClock.sleep(50);
        }

        String state =
            runJavaScript(
                "JSON.stringify({activeId: document.activeElement?.id,"
                    + " controllerEvents: window.__pksxTestControllerEvents,"
                    + " innerWidth, innerHeight,"
                    + " mobileDisplay: getComputedStyle(document.querySelector('.mobile-tabbar')).display,"
                    + " sidebarDisplay: getComputedStyle(document.querySelector('.box-sidebar')).display})"
            );
        fail(
            "Timed out waiting for JavaScript: "
                + expression
                + ", last result: "
                + result
                + ", state: "
                + state
        );
    }

    private String runJavaScript(String script) throws Exception {
        CountDownLatch latch = new CountDownLatch(1);
        AtomicReference<String> result = new AtomicReference<>();

        activityRule
            .getScenario()
            .onActivity(
                activity ->
                    activity
                        .getBridge()
                        .getWebView()
                        .evaluateJavascript(
                            script,
                            value -> {
                                result.set(value);
                                latch.countDown();
                            }
                        )
            );

        if (!latch.await(TIMEOUT_SECONDS, TimeUnit.SECONDS)) {
            fail("Timed out evaluating JavaScript: " + script);
        }
        return result.get();
    }
}
