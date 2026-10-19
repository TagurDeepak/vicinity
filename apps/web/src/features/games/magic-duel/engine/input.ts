/**
 * Magic Duel - PC Keyboard & Mouse Input Manager
 * Uses explicit booleans with automatic blur/focus resets to prevent stuck keys.
 */

export class InputManager {
  canvas: HTMLCanvasElement;
  keys: {
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
  };
  mouseX: number;
  mouseY: number;
  isMouseDown: boolean;
  isRightMouseDown: boolean;
  activeSpell: string;
  dashTriggered: boolean;
  onSpellSelect: ((spellId: string) => void) | null;

  private cleanupFns: (() => void)[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    this.keys = {
      up: false,
      down: false,
      left: false,
      right: false,
    };

    this.mouseX = typeof window !== 'undefined' ? window.innerWidth / 2 : 400;
    this.mouseY = typeof window !== 'undefined' ? window.innerHeight / 2 : 300;
    this.isMouseDown = false;
    this.isRightMouseDown = false;
    this.activeSpell = 'fireball';
    this.dashTriggered = false;
    this.onSpellSelect = null;

    this.bindEvents();
  }

  bindEvents() {
    if (typeof window === 'undefined') return;

    const handleKey = (e: KeyboardEvent, isDown: boolean) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const code = e.code || '';
      const key = (e.key || '').toLowerCase();

      let matched = false;

      // Up (W / ArrowUp / Z for AZERTY)
      if (
        code === 'KeyW' ||
        code === 'ArrowUp' ||
        key === 'w' ||
        key === 'arrowup' ||
        code === 'KeyZ'
      ) {
        this.keys.up = isDown;
        matched = true;
      }

      // Down (S / ArrowDown)
      if (code === 'KeyS' || code === 'ArrowDown' || key === 's' || key === 'arrowdown') {
        this.keys.down = isDown;
        matched = true;
      }

      // Left (A / ArrowLeft / Q for AZERTY)
      if (
        code === 'KeyA' ||
        code === 'ArrowLeft' ||
        key === 'a' ||
        key === 'arrowleft' ||
        code === 'KeyQ'
      ) {
        this.keys.left = isDown;
        matched = true;
      }

      // Right (D / ArrowRight)
      if (code === 'KeyD' || code === 'ArrowRight' || key === 'd' || key === 'arrowright') {
        this.keys.right = isDown;
        matched = true;
      }

      // Dash (Space)
      if (code === 'Space' || key === ' ') {
        if (isDown) {
          this.dashTriggered = true;
        }
        matched = true;
      }

      // Spell Switching 1-4
      if (isDown) {
        if (code === 'Digit1' || key === '1') {
          this.selectSpell('fireball');
          matched = true;
        }
        if (code === 'Digit2' || key === '2') {
          this.selectSpell('frost');
          matched = true;
        }
        if (code === 'Digit3' || key === '3') {
          this.selectSpell('lightning');
          matched = true;
        }
        if (code === 'Digit4' || key === '4') {
          this.selectSpell('shield');
          matched = true;
        }
      }

      // Prevent browser default actions (such as scrolling on S / ArrowDown / Space)
      if (matched) {
        e.preventDefault();
      }
    };

    const onKeyDown = (e: KeyboardEvent) => handleKey(e, true);
    const onKeyUp = (e: KeyboardEvent) => handleKey(e, false);

    window.addEventListener('keydown', onKeyDown, { capture: true, passive: false });
    window.addEventListener('keyup', onKeyUp, { capture: true, passive: false });
    this.cleanupFns.push(() => window.removeEventListener('keydown', onKeyDown, { capture: true }));
    this.cleanupFns.push(() => window.removeEventListener('keyup', onKeyUp, { capture: true }));

    // Focus / Blur safety
    const clearKeys = () => {
      this.keys.up = false;
      this.keys.down = false;
      this.keys.left = false;
      this.keys.right = false;
      this.isMouseDown = false;
      this.isRightMouseDown = false;
      this.dashTriggered = false;
    };

    window.addEventListener('blur', clearKeys);
    window.addEventListener('focus', clearKeys);
    const onVisChange = () => {
      if (document.hidden) clearKeys();
    };
    document.addEventListener('visibilitychange', onVisChange);

    this.cleanupFns.push(() => window.removeEventListener('blur', clearKeys));
    this.cleanupFns.push(() => window.removeEventListener('focus', clearKeys));
    this.cleanupFns.push(() => document.removeEventListener('visibilitychange', onVisChange));

    // Mouse Aiming & Attack Tracking
    const onMouseMove = (e: MouseEvent) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouseX = (e.clientX - rect.left) * (this.canvas.width / (rect.width || 1));
      this.mouseY = (e.clientY - rect.top) * (this.canvas.height / (rect.height || 1));
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        this.isMouseDown = true;
      } else if (e.button === 2) {
        e.preventDefault();
        this.dashTriggered = true;
        this.isRightMouseDown = true;
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        this.isMouseDown = false;
      } else if (e.button === 2) {
        this.isRightMouseDown = false;
      }
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    window.addEventListener('mousemove', onMouseMove);
    this.canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    this.canvas.addEventListener('contextmenu', onContextMenu);

    this.cleanupFns.push(() => window.removeEventListener('mousemove', onMouseMove));
    this.cleanupFns.push(() => this.canvas.removeEventListener('mousedown', onMouseDown));
    this.cleanupFns.push(() => window.removeEventListener('mouseup', onMouseUp));
    this.cleanupFns.push(() => this.canvas.removeEventListener('contextmenu', onContextMenu));
  }

  selectSpell(spellId: string) {
    this.activeSpell = spellId;
    if (this.onSpellSelect) {
      this.onSpellSelect(spellId);
    }
  }

  getMovementVector(): { x: number; y: number } {
    let dx = 0;
    let dy = 0;

    if (this.keys.up) dy -= 1;
    if (this.keys.down) dy += 1;
    if (this.keys.left) dx -= 1;
    if (this.keys.right) dx += 1;

    // Normalize diagonal velocity
    if (dx !== 0 && dy !== 0) {
      const invMag = 1 / Math.SQRT2;
      dx *= invMag;
      dy *= invMag;
    }

    return { x: dx, y: dy };
  }

  getAimAngle(screenCenterX: number, screenCenterY: number): number {
    const dx = this.mouseX - screenCenterX;
    const dy = this.mouseY - screenCenterY;
    const rad = Math.atan2(dy, dx);
    return ((rad * 180) / Math.PI + 360) % 360;
  }

  consumeDash(): boolean {
    if (this.dashTriggered) {
      this.dashTriggered = false;
      return true;
    }
    return false;
  }

  destroy() {
    for (const fn of this.cleanupFns) {
      try {
        fn();
      } catch (_) {}
    }
    this.cleanupFns = [];
  }
}
