"""Automated end-to-end playtest (headless Chromium, SwiftShader WebGL).

Drives the real game through every story state with the same inputs a player
uses (keyboard / clicks), captures screenshots, and fails on console errors,
softlocks, or out-of-order events (pets visible during the letter, etc.).

usage: python3 scripts/playtest.py http://localhost:8765/ outdir [yes|talk] [mobile]
"""
import json
import sys
import time

from playwright.sync_api import sync_playwright

URL = sys.argv[1]
OUT = sys.argv[2]
ANSWER = sys.argv[3] if len(sys.argv) > 3 else 'yes'
MOBILE = len(sys.argv) > 4 and sys.argv[4] == 'mobile'

errors = []
log = []


def shot(page, name):
    page.screenshot(path=f'{OUT}/{name}.png')
    log.append(f'screenshot {name}')


def state(page):
    return page.evaluate('window.__tlt && window.__tlt.story.state')


def wait_state(page, states, timeout=60, advance=True):
    timeout *= 3
    if isinstance(states, str):
        states = [states]
    t0 = time.time()
    while time.time() - t0 < timeout:
        s = state(page)
        if s in states:
            return s
        if advance:
            # advance any open dialogue line / speech bubble
            dlg = page.evaluate("!!(window.__tlt && window.__tlt.ui.dialogueActive)")
            if dlg:
                page.keyboard.press('Space')
        time.sleep(0.25)
    raise RuntimeError(f'timeout waiting for {states}, stuck in {state(page)}')


def walk_to(page, x, z, tol=1.2, timeout=90):
    """Steer the player with WASD toward a world point (camera-relative)."""
    t0 = time.time()
    held = set()
    try:
        while time.time() - t0 < timeout:
            info = page.evaluate(
                """() => { const g = window.__tlt; const p = g.scene.player.root.position;
                return { x: p.x, z: p.z, yaw: g.cam.yaw, cur: g.interactions.current && g.interactions.current.id }; }"""
            )
            dx, dz = x - info['x'], z - info['z']
            import math
            if page.evaluate('window.__tlt.ui.dialogueActive'):
                page.keyboard.press('Space')
            if math.hypot(dx, dz) < tol:
                break
            # camera forward = (-sin yaw, -cos yaw); right = (cos yaw, -sin yaw)
            fy, fz = -math.sin(info['yaw']), -math.cos(info['yaw'])
            rx, rz = math.cos(info['yaw']), -math.sin(info['yaw'])
            f = dx * fy + dz * fz
            r = dx * rx + dz * rz
            want = set()
            if f > 0.3:
                want.add('w')
            if f < -0.3:
                want.add('s')
            if r > 0.3:
                want.add('d')
            if r < -0.3:
                want.add('a')
            for k in held - want:
                page.keyboard.up(k)
            for k in want - held:
                page.keyboard.down(k)
            held = want
            time.sleep(0.1)
        else:
            raise RuntimeError(f'could not reach ({x},{z}) from {info}, dlg={page.evaluate("window.__tlt.ui.dialogueActive")}, ctl={page.evaluate("window.__tlt.scene.control")}')
    finally:
        for k in held:
            page.keyboard.up(k)
    time.sleep(0.4)


def interact(page, expect_id, timeout=25):
    t0 = time.time()
    while time.time() - t0 < timeout:
        cur = page.evaluate('window.__tlt.interactions.current && window.__tlt.interactions.current.id')
        if page.evaluate('window.__tlt.ui.dialogueActive'):
            page.keyboard.press('Space')
        if cur == expect_id:
            if MOBILE:
                page.click('#btn-action')
            else:
                page.keyboard.press('e')
            return
        time.sleep(0.2)
    raise RuntimeError(f'interaction {expect_id} not available (current={cur})')


def main():
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'])
        if MOBILE:
            ctx = b.new_context(viewport={'width': 844, 'height': 390}, device_scale_factor=2, is_mobile=True, has_touch=True)
        else:
            ctx = b.new_context(viewport={'width': 1024, 'height': 576})
        page = ctx.new_page()
        page.on('console', lambda m: (errors.append(m.text) if m.type == 'error' else None))
        page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        page.goto(URL + ('?dev' if not MOBILE else ''))
        page.wait_for_selector('#title:not([hidden])', timeout=60000)
        time.sleep(1.5)
        shot(page, '00-title')
        page.click('#btn-start')

        # ---- Chapter One: LRT (a cutscene: advance lines, close the phone screen)
        t0 = time.time()
        shot_lrt = shot_phone = shot_hand = False
        while state(page) != 'ESPLANADE_EXPLORATION' and time.time() - t0 < 400:
            st = state(page)
            if st == 'LRT_EXPLORATION' and not shot_lrt:
                time.sleep(1.0); shot(page, '01-lrt'); shot_lrt = True
            if page.evaluate("!document.getElementById('phone').hidden"):
                time.sleep(2.5)
                if not shot_phone:
                    shot(page, '02-phone'); shot_phone = True
                page.click('#btn-phone-done')
            if st == 'KEYCHAIN_HANDOFF' and not shot_hand:
                time.sleep(1.2); shot(page, '03-keychain-handoff'); shot_hand = True
            if page.evaluate('window.__tlt.ui.dialogueActive'):
                page.keyboard.press('Space')
            time.sleep(0.4)
        assert state(page) == 'ESPLANADE_EXPLORATION', 'stuck in LRT: ' + str(state(page))
        assert page.evaluate("window.__tlt.save.data.memories.includes('keychain')"), 'keychain memory missing'
        time.sleep(2.5)
        shot(page, '04-esplanade-arrive')
        t0 = time.time()
        while not page.evaluate('window.__tlt.scene.control') and time.time() - t0 < 60:
            page.keyboard.press('Space'); time.sleep(0.3)

        # ---- the bench must be locked before both memories are found
        assert not page.evaluate("window.__tlt.interactions.items.find(i => i.id==='bench').enabled()"), 'bench enabled too early'

        # ---- Tteokbokki: buy at the stall...
        walk_to(page, -7.5, 0.5, tol=0.8)
        walk_to(page, -8, 2.9, tol=0.6)
        shot(page, '05-tteok-stall')
        interact(page, 'tteokbokki')
        wait_state(page, 'TTEOKBOKKI_INTERACTION', 10)
        time.sleep(2.0)
        shot(page, '06-tteokbokki-buy')
        wait_state(page, 'ESPLANADE_EXPLORATION', 60)
        assert not page.evaluate("window.__tlt.interactions.items.find(i => i.id==='bench').enabled()"), 'bench enabled before eating'
        # ...then eat it beside the river
        walk_to(page, -7.5, 0.5, tol=0.8)
        walk_to(page, 0, -2.5, tol=0.8)
        walk_to(page, 0, -3.5, tol=0.6)
        interact(page, 'eat')
        wait_state(page, 'TTEOKBOKKI_INTERACTION', 10)
        time.sleep(2.5)
        shot(page, '06b-eating-by-river')
        wait_state(page, 'ESPLANADE_EXPLORATION', 60)
        assert page.evaluate("window.__tlt.save.data.memories.includes('tteokbokki')"), 'tteokbokki memory missing'
        time.sleep(1.0)

        # ---- Sunflower
        walk_to(page, 6, -3.2, tol=1.4)
        interact(page, 'sunflower')
        wait_state(page, 'SUNFLOWER_INTERACTION', 10)
        t0 = time.time()
        while not page.evaluate("window.__tlt.save.data.memories.includes('sunflower')") and time.time() - t0 < 30:
            if page.evaluate('window.__tlt.ui.dialogueActive') and not page.evaluate("document.getElementById('dialogue').hidden"):
                page.keyboard.press('Space')
            time.sleep(0.3)
        time.sleep(0.3)
        shot(page, '07-sunflower')
        wait_state(page, 'ESPLANADE_EXPLORATION', 30)
        shot(page, '08-market-wide')

        # ---- Bench → letter
        walk_to(page, 9, -2.5, tol=0.8)
        walk_to(page, 18, -3.3, tol=1.4)
        interact(page, 'bench')
        wait_state(page, 'BENCH_CINEMATIC', 10)
        time.sleep(2.2)
        shot(page, '09-bench')
        wait_state(page, 'LETTER_ARRIVAL', 40)
        time.sleep(2.0)
        shot(page, '10-letter-flying')
        wait_state(page, 'LETTER_INTERACTION', 40)
        time.sleep(0.5)
        assert not page.evaluate('window.__tlt.scene.zed.root.visible'), 'pets visible before letter'
        shot(page, '11-letter-hover')
        interact(page, 'letter', 10)
        wait_state(page, 'LETTER_READING', 20, advance=False)
        time.sleep(1.0)
        shot(page, '12-letter-reading')
        # read slowly: the pets must not appear while the letter is open
        time.sleep(4)
        assert state(page) == 'LETTER_READING', 'letter closed itself'
        assert not page.evaluate('window.__tlt.scene.zed.root.visible'), 'pets appeared during reading'
        page.click('#btn-letter-done')
        wait_state(page, 'LETTER_CLOSING', 5, advance=False)
        wait_state(page, 'PETS_REVEAL', 15, advance=False)
        time.sleep(2.0)
        shot(page, '13-pets-arrive')
        wait_state(page, 'PROPOSAL_DIALOGUE', 30, advance=False)
        time.sleep(0.8)
        shot(page, '14-zed-bubble')
        page.keyboard.press('Space')
        time.sleep(1.2)
        shot(page, '15-kooki-bubble')
        page.keyboard.press('Space')
        wait_state(page, 'PROPOSAL_RESPONSE', 10, advance=False)
        page.wait_for_selector('#proposal:not([hidden])')
        time.sleep(0.8)
        shot(page, '16-proposal')

        if ANSWER == 'yes':
            page.click('#btn-yes')
            wait_state(page, 'EPILOGUE', 10, advance=False)
            page.wait_for_selector('#ending:not([hidden])', timeout=90000)
            time.sleep(1.0)
            shot(page, '17-yes-ending')
            page.click('#end-garden')
            wait_state(page, 'MEMORY_GARDEN', 20, advance=False)
            time.sleep(4.5)
            shot(page, '18-garden')
            # open the journal
            page.keyboard.press('j') if not MOBILE else page.click('#btn-journal')
            time.sleep(0.8)
            shot(page, '19-journal')
            n = page.evaluate("document.querySelectorAll('#journal-list .memory:not(.locked)').length")
            assert n == 5, f'journal has {n} memories'
            page.keyboard.press('Escape') if not MOBILE else page.click('#journal [data-close]')
            time.sleep(0.5)
            # visit a keepsake
            pos = page.evaluate("(() => { const i = window.__tlt.interactions.items.find(i => i.id==='keepsake-sunflower'); const p = i.position(); return {x:p.x, z:p.z}; })()")
            walk_to(page, 2.6, 1.8, tol=0.6)
            walk_to(page, 1.6, -2.2, tol=0.6)
            walk_to(page, pos['x'], pos['z'] + 1.0, tol=0.7)
            interact(page, 'keepsake-sunflower')
            page.wait_for_selector('#memory-card:not([hidden])')
            time.sleep(0.6)
            shot(page, '20-keepsake')
            page.click('#mc-close')
            # replay: menu → restart
            page.keyboard.press('Escape') if not MOBILE else page.click('#btn-menu')
            time.sleep(0.4)
            page.click('#btn-restart'); page.click('#btn-restart')
            wait_state(page, ['LRT_INTRO', 'LRT_EXPLORATION'], 30, advance=False)
            log.append('replay ok')
        else:
            page.click('#btn-talk')
            wait_state(page, 'FREE_ROAM', 10, advance=False)
            page.wait_for_selector('#ending:not([hidden])', timeout=90000)
            time.sleep(0.8)
            shot(page, '17-talk-ending')
            page.click('#end-stay')
            t0 = time.time()
            while not page.evaluate('window.__tlt.scene.control') and time.time() - t0 < 15:
                time.sleep(0.3)
            assert page.evaluate('window.__tlt.scene.control'), 'no control after talk ending'
            shot(page, '18-free-roam')
            # sit again (bench is available in free roam)
            walk_to(page, 18, -3.3, tol=1.4)
            interact(page, 'bench')
            wait_state(page, 'BENCH_CINEMATIC', 10, advance=False)
            log.append('re-sit ok')

        save = page.evaluate("localStorage.getItem('the-little-things.save.v1')")
        log.append('save: ' + save)
        dev = page.evaluate("document.getElementById('dev').textContent")
        log.append('dev: ' + dev)
        b.close()


try:
    main()
    ok = True
except Exception as e:  # noqa
    ok = False
    log.append(f'FAIL: {e}')
print(json.dumps({'ok': ok and not errors, 'errors': errors[:20], 'log': log}, indent=1))
