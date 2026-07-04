const { createCanvas, loadImage } = require('@napi-rs/canvas');
const bwipjs = require('bwip-js');

const WIDTH = 1482;
const HEIGHT = 1594;
const BLACK = '#000000';
const WHITE = '#ffffff';
const BARCODE_TYPE = 'code128';

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawLine(ctx, x1, y1, x2, y2, width = 6) {
  ctx.save();
  ctx.strokeStyle = BLACK;
  ctx.lineWidth = width;
  ctx.lineCap = 'square';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

function setFont(ctx, weight, size) {
  ctx.font = `${weight} ${size}px Arial, Helvetica, sans-serif`;
}

function drawSpacedText(ctx, text, x, y, letterSpacing) {
  let cursor = x;
  for (const char of text) {
    ctx.fillText(char, cursor, y);
    cursor += ctx.measureText(char).width + letterSpacing;
  }
}

function measureSpacedText(ctx, text, letterSpacing) {
  return Array.from(text).reduce((width, char, index) => {
    return width + ctx.measureText(char).width + (index === text.length - 1 ? 0 : letterSpacing);
  }, 0);
}

function drawCenteredSpacedText(ctx, text, centerX, y, letterSpacing) {
  const width = measureSpacedText(ctx, text, letterSpacing);
  drawSpacedText(ctx, text, centerX - width / 2, y, letterSpacing);
}

function wrapText(ctx, text, maxWidth) {
  const paragraphs = String(text || '').split(/\r?\n/);
  const lines = [];

  paragraphs.forEach((paragraph) => {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);

    if (!words.length) {
      lines.push('');
      return;
    }

    let line = '';
    words.forEach((word) => {
      const testLine = line ? `${line} ${word}` : word;
      if (ctx.measureText(testLine).width <= maxWidth) {
        line = testLine;
        return;
      }

      if (line) {
        lines.push(line);
        line = '';
      }

      if (ctx.measureText(word).width <= maxWidth) {
        line = word;
        return;
      }

      let chunk = '';
      for (const char of word) {
        const testChunk = `${chunk}${char}`;
        if (ctx.measureText(testChunk).width <= maxWidth) {
          chunk = testChunk;
        } else {
          lines.push(chunk);
          chunk = char;
        }
      }
      line = chunk;
    });

    if (line) {
      lines.push(line);
    }
  });

  return lines;
}

function drawTextBlock(ctx, text, x, y, maxWidth, maxHeight, options = {}) {
  const {
    fontWeight = 700,
    fontSize = 42,
    lineHeight = Math.round(fontSize * 1.18)
  } = options;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, maxWidth, maxHeight);
  ctx.clip();
  setFont(ctx, fontWeight, fontSize);
  ctx.fillStyle = BLACK;
  ctx.textBaseline = 'top';

  const lines = wrapText(ctx, text, maxWidth);
  const maxLines = Math.floor(maxHeight / lineHeight);
  lines.slice(0, maxLines).forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight);
  });
  ctx.restore();
}

function drawLabel(ctx, label, value, x, y, width, height, options = {}) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.clip();

  setFont(ctx, 900, options.labelSize || 48);
  ctx.fillStyle = BLACK;
  ctx.textBaseline = 'top';
  ctx.fillText(label, x, y);

  if (value) {
    drawTextBlock(ctx, value, x, y + (options.valueTop || 72), width, height - (options.valueTop || 72), {
      fontWeight: options.valueWeight || 800,
      fontSize: options.valueSize || 40,
      lineHeight: options.lineHeight || 48
    });
  }

  ctx.restore();
}

async function barcodeImage(value) {
  const png = await bwipjs.toBuffer({
    bcid: BARCODE_TYPE,
    text: value,
    scale: 5,
    height: 18,
    includetext: false,
    backgroundcolor: 'FFFFFF',
    paddingwidth: 0,
    paddingheight: 0
  });

  return loadImage(png);
}

async function renderOrderLabelPng(order) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = WHITE;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = BLACK;
  ctx.strokeStyle = BLACK;

  const left = 18;
  const top = 10;
  const right = 1464;
  const bottom = 1582;
  const innerWidth = right - left;

  ctx.lineWidth = 7;
  roundedRect(ctx, left, top, innerWidth, bottom - top, 28);
  ctx.stroke();

  const lines = {
    header: 230,
    order: 350,
    receiver: 585,
    address: 810,
    items: 1040,
    payment: 1225,
    notes: 1325
  };

  Object.values(lines).forEach((y) => drawLine(ctx, left, y, right, y));
  drawLine(ctx, 740, lines.items, 740, lines.payment);

  ctx.textBaseline = 'alphabetic';
  setFont(ctx, 900, 116);
  drawCenteredSpacedText(ctx, 'TRIZODIAC', WIDTH / 2, 140, 14);
  setFont(ctx, 900, 38);
  drawCenteredSpacedText(ctx, 'THANK YOU FOR YOUR ORDER!', WIDTH / 2, 200, 20);

  setFont(ctx, 900, 48);
  ctx.textBaseline = 'top';
  ctx.fillText('ORDER #:', 66, 258);
  setFont(ctx, 900, 42);
  ctx.fillText(order.order_number, 310, 262);
  setFont(ctx, 900, 42);
  ctx.fillText('DATE:', 66, 306);
  ctx.fillText(order.order_date_display, 218, 306);

  drawLabel(ctx, 'RECEIVER:', order.receiver, 66, 392, 1340, 160);
  drawLabel(ctx, 'ADDRESS:', order.address, 66, 624, 1340, 155);
  drawLabel(ctx, 'ITEMS:', order.items, 66, 850, 1340, 160);
  drawLabel(ctx, 'PAYMENT:', order.payment, 66, 1082, 610, 112, {
    valueTop: 70,
    valueSize: 37,
    lineHeight: 42
  });
  drawLabel(ctx, 'TOTAL:', order.total_display, 800, 1082, 600, 112, {
    valueTop: 70,
    valueSize: 37,
    lineHeight: 42
  });
  drawLabel(ctx, 'NOTES:', order.notes || '', 66, 1258, 1340, 46, {
    labelSize: 42,
    valueTop: 48,
    valueSize: 28,
    lineHeight: 32
  });

  const barcode = await barcodeImage(order.barcode_value || order.order_number);
  ctx.drawImage(barcode, 184, 1364, 1114, 96);

  setFont(ctx, 500, 46);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'center';
  ctx.fillText(order.barcode_value || order.order_number, WIDTH / 2, 1538);

  return canvas.toBuffer('image/png');
}

module.exports = {
  renderOrderLabelPng
};
