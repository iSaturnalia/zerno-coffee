// "Brew at home": a V60 recipe that scales with cups and strength.
const { gsap } = window;
const $ = (s) => document.querySelector(s);

const CUP_ML = 250;
const fmt = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

export function initBrew() {
  const cupsGroup = $('#bCups');
  const strengthGroup = $('#bStrength');
  const out = { coffee: $('#bCoffee'), water: $('#bWater'), time: $('#bTime') };
  const fill = $('#bFill');
  const steps = $('#bSteps');
  const shown = { coffee: 16, water: 250, time: 150 }; // what the numbers display now

  const value = (group) => Number(group.querySelector('[aria-checked="true"]').dataset.v);

  function recipe() {
    const cups = value(cupsGroup);
    const ratio = value(strengthGroup); // grams of water per gram of coffee
    const water = cups * CUP_ML;
    const coffee = Math.round(water / ratio);
    const time = Math.min(150 + (cups - 1) * 30, 240);
    return {
      cups, coffee, water, time,
      bloom: coffee * 2,
      grind: cups >= 3 ? 'средне-крупный' : 'средний',
    };
  }

  function render() {
    const r = recipe();
    // numbers count to their new values
    gsap.to(shown, {
      coffee: r.coffee, water: r.water, time: r.time, duration: 0.6, ease: 'power2.out',
      onUpdate: () => {
        out.coffee.textContent = `${Math.round(shown.coffee)} г`;
        out.water.textContent = `${Math.round(shown.water)} мл`;
        out.time.textContent = fmt(shown.time);
      },
    });
    // the carafe fills to the new level (4 cups = full)
    gsap.to(fill, { height: `${(r.water / (4 * CUP_ML)) * 86 + 6}%`, duration: 1.1, ease: 'power2.inOut' });
    steps.innerHTML = `
      <li>Промой бумажный фильтр горячей водой и слей её.</li>
      <li>Засыпь <b>${r.coffee} г</b> кофе, помол ${r.grind}.</li>
      <li>Цветение: <b>${r.bloom} мл</b> воды 92°C, подожди 45 секунд.</li>
      <li>Доливай кругами до <b>${r.water} мл</b> к ${fmt(r.time - 45)}.</li>
      <li>Дай стечь — готово к <b>${fmt(r.time)}</b>.</li>`;
  }

  // radio-group behaviour: click, and arrow keys move the selection
  for (const group of [cupsGroup, strengthGroup]) {
    const buttons = [...group.querySelectorAll('[role="radio"]')];
    const select = (b) => {
      for (const x of buttons) {
        x.setAttribute('aria-checked', String(x === b));
        x.tabIndex = x === b ? 0 : -1;
      }
      render();
    };
    buttons.forEach((b) => { b.tabIndex = b.getAttribute('aria-checked') === 'true' ? 0 : -1; });
    group.addEventListener('click', (e) => {
      const b = e.target.closest('[role="radio"]');
      if (b) select(b);
    });
    group.addEventListener('keydown', (e) => {
      const i = buttons.indexOf(document.activeElement);
      if (i < 0) return;
      const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      const next = buttons[(i + d + buttons.length) % buttons.length];
      next.focus();
      select(next);
    });
  }

  render();
}
