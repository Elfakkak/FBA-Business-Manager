# Project instructions

## Always keep README.md current
After finishing **any** page or component change, update `README.md` before ending the turn:
- Update the **Current state** section to reflect what is now built/changed.
- Add a dated entry to the **Change log** table.
- If the architecture, file list, or script load order changed, update those sections too.

`README.md` is the handoff document — it must let any human or AI tool understand where the project stands and continue without re-discovering the codebase. Read it first at the start of a session.

## Quick orientation
- Three entry points: `Vyonix Orders List.html`, `Vyonix Order Shell.html`, `Vyonix Production.html`.- React 18 + in-browser Babel, no build step. Each `.jsx` ends with `Object.assign(window, {...})`; script load order matters.
- All styling lives in `vy-app.css` using HSL CSS vars. Brand color = Vyonix orange. Don't invent colors.
- See `README.md` for the full architecture, file map, and current state.
