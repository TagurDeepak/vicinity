# Accessibility

Vicinity targets **WCAG 2.1 AA**. Accessibility is a first-class requirement, not
a retrofit. This document lists what is implemented and what remains.

## Keyboard navigation

- All interactive controls are native elements (`button`, `input`, `select`,
  `a`) and are reachable/operable by keyboard.
- The floor canvas is focusable (`tabIndex=0`), exposes
  `role="application"` with an `aria-label` describing controls, and supports
  **Arrow keys / WASD** to move and click-to-walk.
- Visible focus rings use a 2px brand ring with offset
  (`focus-visible:ring-2`).

**To add**: a keyboard-accessible alternative to click-to-walk targeting (e.g.
tab through zones and press Enter to walk to a zone), and a documented shortcut
list.

## Color & contrast

- The design system (`packages/ui`, `tailwind.config.ts`) uses an original
  palette chosen for readable contrast: ink text on light surfaces meets AA for
  body text.
- Status is never conveyed by color alone — `StatusDot` includes an
  `aria-label`/`title` ("Available", "Busy", …).

**To verify**: run automated contrast checks (axe) on every screen and confirm
AA for all text and UI components, including the brand button states.

## Screen reader considerations

- Form fields use associated `<label>`s; invalid fields set `aria-invalid` and
  reference an error via `aria-describedby` (`TextField`).
- Media toggles expose `aria-pressed` and descriptive `aria-label`s that reflect
  the action ("Mute microphone" / "Unmute microphone").
- The status selector has an associated (visually hidden) label.

**To add**: an `aria-live` region announcing presence changes ("Ada joined"),
new chat messages, and conversation start/stop, so non-visual users track the
floor. Provide a list-based (non-canvas) view of who is nearby.

## Motion sensitivity

- Global `prefers-reduced-motion` handling in `globals.css` reduces animation
  and transition durations to near-zero.
- The canvas render loop should also respect reduced motion by snapping avatar
  positions instead of smoothly interpolating — *to implement*.

## Accessible controls checklist

- [x] All controls keyboard-operable
- [x] Visible focus indicators
- [x] Labels associated with inputs
- [x] Error messaging linked via `aria-describedby`
- [x] `aria-pressed` on toggles
- [x] Status not color-only
- [x] `prefers-reduced-motion` respected (CSS)
- [ ] `aria-live` announcements for presence/chat
- [ ] Non-canvas "nearby people" list for screen readers
- [ ] Automated axe checks in CI
- [ ] Full audit with a screen reader (NVDA/VoiceOver)
