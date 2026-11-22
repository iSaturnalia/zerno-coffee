// Texts that the scripts put on the page (the static copy lives in the HTML).
// The language comes from <html lang>: index.html is Russian, en/index.html English.

export const lang = document.documentElement.lang === 'en' ? 'en' : 'ru';

const ru = {
  money: (n) => `${n.toLocaleString('ru-RU')} ₽`,
  g: 'г',
  ml: 'мл',
  light: { evening: 'свет на сайте сейчас вечерний', morning: 'свет на сайте сейчас утренний', day: 'свет на сайте сейчас дневной' },
  sound: { on: 'Выключить звук', off: 'Включить звук', rowOn: 'вкл', rowOff: 'выкл' },
  cart: {
    order: 'Заказать',
    withItems: (n) => `Корзина · ${n}`,
    openAria: (n) => `Открыть корзину, товаров: ${n}`,
    removeOne: (name) => `Убрать одну: ${name}`,
    addOne: (name) => `Добавить ещё: ${name}`,
    cardAria: (name, price) => `${name}, ${price}. Подробнее`,
    plusAria: (name) => `В корзину: ${name}`,
  },
  hint: {
    artTouch: 'Рисуй пальцем по пенке',
    artMouse: 'Рисуй по пенке: зажми и веди',
    spinTouch: 'Крути модель пальцем',
    spinMouse: 'Крути модель: зажми и тяни',
  },
  info: {
    espresso: { meta: '30 мл · двойной шот', desc: 'Зерно «Эфиопия»: ягодная кислинка и шоколадное послевкусие. Мелем за минуту до приготовления.' },
    pourover: { meta: '250 мл · 3:30', desc: 'Фильтр через воронку V60. Медленная заливка раскрывает чайные и цветочные ноты.' },
    latte: { meta: '250 мл · молоко 3,2%', desc: 'Эспрессо и бархатное молоко. Нарисуй узор на пенке — пальцем или мышкой.', art: true },
    beans: { meta: '250 г · обжарка раз в неделю', desc: 'Мытая обработка, высота 1900 м. Подходит и для фильтра, и для эспрессо.' },
    kettle: { meta: '0,9 л · сталь', desc: 'Тонкий носик для точной заливки и термометр на крышке.' },
    grinder: { meta: '40 ступеней помола', desc: 'Стальные жернова и стеклянный бункер на 250 г. Та самая, что на первом экране.' },
  },
  brew: {
    grind: (cups) => (cups >= 3 ? 'средне-крупный' : 'средний'),
    steps: (r, fmt) => `
      <li>Промой бумажный фильтр горячей водой и слей её.</li>
      <li>Засыпь <b>${r.coffee} г</b> кофе, помол ${r.grind}.</li>
      <li>Цветение: <b>${r.bloom} мл</b> воды 92°C, подожди 45 секунд.</li>
      <li>Доливай кругами до <b>${r.water} мл</b> к ${fmt(r.time - 45)}.</li>
      <li>Дай стечь — готово к <b>${fmt(r.time)}</b>.</li>`,
  },
};

const en = {
  money: (n) => `$${n.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2 })}`,
  g: 'g',
  ml: 'ml',
  light: { evening: 'the light here follows your clock: evening', morning: 'the light here follows your clock: morning', day: 'the light here follows your clock: daytime' },
  sound: { on: 'Turn sound off', off: 'Turn sound on', rowOn: 'on', rowOff: 'off' },
  cart: {
    order: 'Order',
    withItems: (n) => `Cart · ${n}`,
    openAria: (n) => `Open cart, items: ${n}`,
    removeOne: (name) => `Remove one: ${name}`,
    addOne: (name) => `Add one more: ${name}`,
    cardAria: (name, price) => `${name}, ${price}. Details`,
    plusAria: (name) => `Add to cart: ${name}`,
  },
  hint: {
    artTouch: 'Draw on the foam with a finger',
    artMouse: 'Draw on the foam: press and drag',
    spinTouch: 'Rotate the model with a finger',
    spinMouse: 'Rotate the model: press and drag',
  },
  info: {
    espresso: { meta: '30 ml · double shot', desc: 'Ethiopian beans: berry brightness and a chocolate finish. Ground a minute before brewing.' },
    pourover: { meta: '250 ml · 3:30', desc: 'Filter coffee through a V60 dripper. A slow pour brings out tea and floral notes.' },
    latte: { meta: '250 ml · whole milk', desc: 'Espresso and velvety milk. Draw a pattern on the foam with a finger or the mouse.', art: true },
    beans: { meta: '250 g · roasted weekly', desc: 'Washed process, grown at 1,900 m. Works for both filter and espresso.' },
    kettle: { meta: '0.9 l · steel', desc: 'A thin spout for precise pouring and a thermometer on the lid.' },
    grinder: { meta: '40 grind settings', desc: 'Steel burrs and a 250 g glass hopper. The very one from the first screen.' },
  },
  brew: {
    grind: (cups) => (cups >= 3 ? 'medium-coarse' : 'medium'),
    steps: (r, fmt) => `
      <li>Rinse the paper filter with hot water and discard the water.</li>
      <li>Add <b>${r.coffee} g</b> of coffee, ${r.grind} grind.</li>
      <li>Bloom: <b>${r.bloom} ml</b> of 92°C water, wait 45 seconds.</li>
      <li>Pour in circles up to <b>${r.water} ml</b> by ${fmt(r.time - 45)}.</li>
      <li>Let it drain — ready at <b>${fmt(r.time)}</b>.</li>`,
  },
};

export const T = lang === 'en' ? en : ru;
