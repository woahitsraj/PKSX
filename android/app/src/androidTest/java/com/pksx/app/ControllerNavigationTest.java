package com.pksx.app;

import static org.junit.Assert.fail;

import android.os.SystemClock;
import android.view.InputDevice;
import android.view.KeyCharacterMap;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.util.Base64;
import androidx.test.ext.junit.rules.ActivityScenarioRule;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import org.junit.Rule;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class ControllerNavigationTest {
    private static final long TIMEOUT_SECONDS = 20;

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
        runJavaScript("document.querySelector('#mobile-tab-1').click()");
        awaitJavaScript("location.pathname.endsWith('/save-file')");

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
        awaitJavaScript("document.body.textContent.includes('emerald.sav imported and made active.')");
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
        long deadline = SystemClock.uptimeMillis() + TimeUnit.SECONDS.toMillis(TIMEOUT_SECONDS);
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
