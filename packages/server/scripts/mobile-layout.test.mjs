import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../../mobile/src/components/designCanvasLayout.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } });
const { getDesignCanvasLayout } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const close = (a, b) => assert.ok(Math.abs(a - b) < 0.000001, `${a} differs from ${b}`);
const noInsets = { left: 0, right: 0, top: 0, bottom: 0 };

test("iPhone notch is reserved only on the side where it exists", () => {
  const layout = getDesignCanvasLayout(852,393,{ left: 59,right: 0,top: 0,bottom: 21 },true);
  assert.equal(layout.paddingLeft,59); assert.equal(layout.paddingRight,8);
  assert.equal(layout.paddingTop,4); assert.equal(layout.paddingBottom,21);
  close(layout.canvasWidth * layout.scale, 852 - 59 - 8);
});
test("rotating an iPhone reverses the notch margin without changing available width", () => {
  const left = getDesignCanvasLayout(852,393,{ left: 59,right: 0,top: 0,bottom: 21 },true);
  const right = getDesignCanvasLayout(852,393,{ left: 0,right: 59,top: 0,bottom: 21 },true);
  assert.equal(right.paddingLeft,8); assert.equal(right.paddingRight,59);
  close(left.canvasWidth,right.canvasWidth); close(left.scale,right.scale);
});
test("wide iOS landscapes fill the safe width without scaling controls past the viewport", () => {
  const layout = getDesignCanvasLayout(1024,390,{ left: 59,right: 0,top: 0,bottom: 21 },true);
  assert.ok(layout.canvasWidth > 844);
  close(layout.canvasWidth * layout.scale,layout.viewportWidth);
  assert.ok(layout.canvasHeight * layout.scale <= layout.viewportHeight);
});
test("all supported landscape sizes keep the complete iOS canvas inside safe bounds", () => {
  for (const [width,height] of [[667,375],[812,375],[844,390],[852,393],[932,430],[1194,834]]) {
    const layout = getDesignCanvasLayout(width,height,noInsets,true);
    close(layout.canvasWidth * layout.scale + layout.paddingLeft + layout.paddingRight,width);
    assert.ok(layout.canvasHeight * layout.scale + layout.paddingTop + layout.paddingBottom <= height + 0.000001);
  }
});
test("Android keeps its established fixed canvas, symmetric insets and scale", () => {
  const layout = getDesignCanvasLayout(915,412,{ left: 30,right: 0,top: 0,bottom: 16 },false,0.982278);
  assert.equal(layout.canvasWidth,844); assert.equal(layout.canvasHeight,390);
  assert.equal(layout.paddingLeft,30); assert.equal(layout.paddingRight,30);
  assert.equal(layout.paddingTop,16); assert.equal(layout.paddingBottom,16);
  close(layout.scale,Math.min((915-60)/844,(412-32)/390)*0.982278);
});
test("initial zero-sized layout measurements still produce finite positive geometry", () => {
  const layout = getDesignCanvasLayout(0,0,{ left: 59,right: 0,top: 0,bottom: 21 },true);
  assert.ok(Number.isFinite(layout.scale) && layout.scale > 0);
  assert.ok(Number.isFinite(layout.canvasWidth) && layout.canvasWidth > 0);
});
