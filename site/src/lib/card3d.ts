// A business card the customer can turn in 3D (Peter, Nov 14 2026): drag it (mouse or finger) to tilt it,
// Flip to see the other side, Reset to face it straight on. It shows what was picked in the order form: a
// gloss shine that moves with the tilt, soft touch's velvet, linen's weave, thick paper's edge, and square
// or rounded corners. Front and Back buttons under it (like an online print shop's preview) turn it to
// face that side straight on; dragging still turns it any way. Browser only; the faces are the same pictures the card renderer prints from.
// The flat front and back on the review page stay as the exact proof; this is for the look and feel.

export interface Card3DLook { stock?: string; finish?: string; corners?: string }

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Builds the viewer inside `host`. Returns a function that removes its listeners. */
export function mountCard3D(host: HTMLElement, frontSvg: string, backSvg: string, look: Card3DLook, labels: { front: string; back: string; hint: string }) {
  const finish = look.finish ?? 'matte', stock = look.stock ?? 'standard', rounded = look.corners === 'rounded';
  host.innerHTML = `
    <div class="c3d-stage" tabindex="0" role="group" aria-roledescription="3D card" aria-label="${labels.hint}">
      <div class="c3d-shadow"></div>
      <div class="c3d-card ${rounded ? 'rounded' : ''} stock-${stock} finish-${finish}">
        ${[1, 2, 3, 4].map((i) => `<div class="c3d-layer" style="--i:${i}"></div>`).join('')}
        <div class="c3d-face c3d-front"><div class="c3d-art">${frontSvg}</div><div class="c3d-tex"></div><div class="c3d-sheen"></div></div>
        <div class="c3d-face c3d-back"><div class="c3d-art">${backSvg}</div><div class="c3d-tex"></div><div class="c3d-sheen"></div></div>
      </div>
    </div>
    <p class="c3d-tools"><span class="c3d-sides" role="group"><button type="button" class="c3d-side" data-act="front" aria-pressed="true">${labels.front}</button><button type="button" class="c3d-side" data-act="back" aria-pressed="false">${labels.back}</button></span> <span class="muted">${labels.hint}</span></p>`;
  const stage = host.querySelector<HTMLElement>('.c3d-stage')!, card = host.querySelector<HTMLElement>('.c3d-card')!, shadow = host.querySelector<HTMLElement>('.c3d-shadow')!;
  // Start slightly turned, like a card lying on a desk, so it reads as an object.
  let rx = 14, ry = -18, flipped = false, drag: { x: number; y: number; rx: number; ry: number } | null = null;
  const paint = (smooth: boolean) => {
    card.style.transition = smooth ? 'transform .6s cubic-bezier(.2,.8,.2,1)' : 'none';
    const y = ry + (flipped ? 180 : 0);
    card.style.transform = `rotateX(${rx}deg) rotateY(${y}deg)`;
    // The shine slides across as the card turns; the shadow follows the tilt.
    card.style.setProperty('--sheen', `${50 + ((((y % 360) + 540) % 360) - 180) * 0.5 + rx * 0.6}%`);
    shadow.style.transform = `translateX(${-ry * 0.6}px) scale(${1 - Math.abs(rx) / 200}, ${0.5 - rx / 300})`;
    // Which side faces the customer right now (after any dragging) lights up its button.
    const facing = Math.cos(((y % 360) * Math.PI) / 180) * Math.cos((rx * Math.PI) / 180) >= 0 ? 'front' : 'back';
    host.querySelectorAll<HTMLElement>('.c3d-side').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.act === facing)));
  };
  // Turn to face one side straight on, the short way round.
  const face = (side: 'front' | 'back') => { const want = side === 'back' ? 180 : 0; const now = ry + (flipped ? 180 : 0); const turns = Math.round((now - want) / 360); flipped = false; ry = want + turns * 360; rx = 0; paint(true); };
  const down = (e: PointerEvent) => { drag = { x: e.clientX, y: e.clientY, rx, ry }; stage.setPointerCapture(e.pointerId); stage.classList.add('grabbing'); };
  const move = (e: PointerEvent) => {
    if (!drag) return;
    ry = drag.ry + (e.clientX - drag.x) * 0.5;
    rx = clamp(drag.rx - (e.clientY - drag.y) * 0.4, -45, 45);
    paint(false);
  };
  const up = () => { drag = null; stage.classList.remove('grabbing'); };
  const key = (e: KeyboardEvent) => {
    const step = 8;
    if (e.key === 'ArrowLeft') ry -= step; else if (e.key === 'ArrowRight') ry += step;
    else if (e.key === 'ArrowUp') rx = clamp(rx + step, -45, 45); else if (e.key === 'ArrowDown') rx = clamp(rx - step, -45, 45);
    else if (e.key === 'Enter' || e.key === ' ' || e.key.toLowerCase() === 'f') flipped = !flipped;
    else return;
    e.preventDefault(); paint(true);
  };
  const click = (e: Event) => {
    const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
    if (act === 'front' || act === 'back') face(act);
  };
  stage.addEventListener('pointerdown', down); stage.addEventListener('pointermove', move);
  stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
  stage.addEventListener('keydown', key); host.addEventListener('click', click);
  paint(false);
  return () => { host.removeEventListener('click', click); host.innerHTML = ''; };
}
