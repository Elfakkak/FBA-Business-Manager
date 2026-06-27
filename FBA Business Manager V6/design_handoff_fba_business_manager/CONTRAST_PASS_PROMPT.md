# Claude Code prompt — App-wide contrast pass

Paste this to Claude Code in the production repo. It replicates the design-prototype's contrast tuning at the **design-token layer** (the prototype did it in `vy-app.css :root`; in the real app these live in `globals.css` / your Tailwind HSL token config).

---

## Prompt

> Our app uses a warm cream / monochrome palette that's too low-contrast: beige inputs sit on near-beige cards, and cards barely separate from the canvas, so the visual hierarchy reads flat. Do a **token-level contrast pass** in the global theme tokens (`globals.css :root`, or the Tailwind HSL token config) so **every page sharpens at once** — do NOT restyle components one by one.
>
> Keep the calm identity and the single orange brand accent. Don't introduce new colors or turn it into a colorful dashboard. Lean only on the **existing semantic tokens** (success/warning/danger/info) where numbers already carry good/bad meaning. Leave **dark mode untouched**.
>
> Make exactly these light-mode token changes (HSL `H S% L%` triplets):
>
> | Token | Before | After | Why |
> |---|---|---|---|
> | `--background` | `42 25% 96%` | `42 28% 94%` | deeper canvas so near-white cards lift off it |
> | `--border` | `38 18% 84%` | `36 16% 80%` | crisper edges on every card/divider |
> | `--input` | `38 18% 84%` | `36 15% 78%` | inputs read as distinct fields, not flat fills |
> | `--muted-bg` | `39 22% 92%` | `38 20% 89%` | chips / segmented toggles / table headers separate |
> | `--muted-fg` | `34 8% 41%` | `32 9% 39%` | secondary text a touch stronger |
> | `--shadow-sm` | `0 1px 2px /0.05` | `0 1px 2px /0.06, 0 2px 6px /0.04` | gentle card lift |
> | `--shadow-md` | `0 1px 2px /0.06, 0 8px 24px /0.06` | `0 1px 2px /0.07, 0 10px 28px /0.08` | stronger lift on hover/raised |
>
> And update the base card style so cards have a real frame: use a **solid** `--card` background and a **full-opacity** `--border` (the prototype had translucent `card / 0.85` + `border / 0.8` which made cards blend into the canvas — drop both opacities to 1).
>
> Also verify the inputs have a visible focus ring (border → `--ring` + a 3px `ring/0.18` box-shadow) and that `:focus-visible` gives a 2px ring on inline-styled inputs.
>
> After the change: confirm light mode shows clearly framed cards, distinct input fields, and readable table headers, and that dark mode is unchanged.

---

## Bonus (optional, same pass)
There's a latent bug worth fixing while you're in the tokens: code that builds colors like `hsl(var(--${tone}))` can receive `tone = "muted"`, but **there is no `--muted` token** (only `--muted-fg` / `--muted-bg`), so the rule silently produces an invalid color (no border/tint renders). Either add a `--muted` alias, or map `"muted" → "muted-fg"` at the call sites (e.g. result/verdict cards in the FBA calculator).
