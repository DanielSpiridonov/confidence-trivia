import React, { useEffect, useState } from "react";
import { Animated, LayoutChangeEvent, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { PanResponder } from "react-native";
import { useTranslation } from "react-i18next";
import { Room } from "colyseus.js";
import { ANDROID_GAME_UI_SCALE, Screen, Title, BigButton, theme } from "../components/ui";
import { useRoomState } from "../network/client";
import { PhaseTimer } from "../components/PhaseTimer";
import { DamageHud } from "../components/DamageHud";

interface MeasuredRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function QuestionScreen({ room }: { room: Room }) {
  const { t } = useTranslation();
  const state = useRoomState<any>(room);
  const [selected, setSelected] = useState<number | null>(null);
  const [slotOrder, setSlotOrder] = useState<Array<number | null>>([]);
  const [freeAnswer, setFreeAnswer] = useState("");
  const [locked, setLocked] = useState(false);
  const [draggingCardIndex, setDraggingCardIndex] = useState<number | null>(null);
  const [draggingCardSize, setDraggingCardSize] = useState({ width: 0, height: 0 });
  const boardRef = React.useRef<View | null>(null);
  const slotRefs = React.useRef<Array<View | null>>([]);
  const cardRefs = React.useRef<Array<View | null>>([]);
  const draggingCardIndexRef = React.useRef<number | null>(null);
  const boardWindowOriginRef = React.useRef<{ x: number; y: number } | null>(null);
  const cardSizesRef = React.useRef<Record<number, { width: number; height: number }>>({});
  const dragPosition = React.useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  // Reset local UI state at the start of every new round.
  useEffect(() => {
    setSelected(null);
    setFreeAnswer("");
    setLocked(false);
    setDraggingCardIndex(null);
    draggingCardIndexRef.current = null;
    boardWindowOriginRef.current = null;
    dragPosition.setValue({ x: 0, y: 0 });
  }, [state?.currentQuestion?.id]);

  if (!state) return null;
  const q = state.currentQuestion;
  const options: string[] = [...q.options];
  const isNumericFreeTextQuestion = q.qType === "estimate" || q.qType === "closest_answer";
  const isFreeTextQuestion = q.qType === "word" || isNumericFreeTextQuestion;
  const isOrderingQuestion = q.qType === "ordering";
  const difficultyStyle = q.difficulty === "easy"
    ? { color: "#7CFFA0", backgroundColor: "rgba(124, 255, 160, 0.12)" }
    : q.difficulty === "medium"
      ? { color: "#FFD166", backgroundColor: "rgba(255, 209, 102, 0.12)" }
      : { color: theme.danger, backgroundColor: "rgba(255, 92, 122, 0.12)" };
  const parsedNumericAnswer = Number(freeAnswer.trim().replace(",", "."));
  const canSubmitFreeAnswer = isNumericFreeTextQuestion
    ? freeAnswer.trim().length > 0 && Number.isFinite(parsedNumericAnswer)
    : freeAnswer.trim().length > 0;

  useEffect(() => {
    if (!isOrderingQuestion) return;
    setSlotOrder(options.map((_, index) => index).sort(() => Math.random() - 0.5));
  }, [isOrderingQuestion, options.length, q.id]);

  const canSubmitOrdering = isOrderingQuestion
    && slotOrder.length === options.length
    && slotOrder.every((cardIndex) => cardIndex !== null);

  function submit(index: number) {
    if (locked) return;
    setSelected(index);
    setLocked(true);
    room.send("submitAnswer", { value: index });
  }

  function submitFreeAnswer() {
    if (locked || !canSubmitFreeAnswer) return;
    setLocked(true);
    room.send("submitAnswer", {
      value: isNumericFreeTextQuestion ? parsedNumericAnswer : freeAnswer.trim(),
    });
  }

  function placeCardIntoSlot(cardIndex: number, targetSlotIndex: number) {
    setSlotOrder((current) => {
      const next = [...current];
      const sourceSlotIndex = next.findIndex((value) => value === cardIndex);
      const displacedCardIndex = next[targetSlotIndex];

      if (sourceSlotIndex < 0 || displacedCardIndex === undefined || displacedCardIndex === null) {
        return current;
      }

      next[sourceSlotIndex] = displacedCardIndex;
      next[targetSlotIndex] = cardIndex;
      return next;
    });
  }

  async function measureRect(view: View | null): Promise<MeasuredRect | null> {
    if (!view) return null;

    return new Promise((resolve) => {
      view.measureInWindow((x, y, width, height) => {
        resolve({ x, y, width, height });
      });
    });
  }

  function beginDrag(cardIndex: number, pageX: number, pageY: number) {
    if (locked) return;
    draggingCardIndexRef.current = cardIndex;
    setDraggingCardIndex(cardIndex);

    const size = cardSizesRef.current[cardIndex] ?? { width: 80, height: 64 };
    setDraggingCardSize(size);
    boardRef.current?.measureInWindow((boardX, boardY) => {
      if (draggingCardIndexRef.current !== cardIndex) return;
      boardWindowOriginRef.current = { x: boardX, y: boardY };
      dragPosition.setValue({
        x: pageX - boardX - size.width / 2,
        y: pageY - boardY - size.height / 2,
      });
    });
  }

  async function findDropSlotIndex(pageX: number, pageY: number) {
    const slotRects = await Promise.all(slotRefs.current.map((slotRef) => measureRect(slotRef ?? null)));
    return slotRects.findIndex((slotRect) => {
      if (!slotRect) return false;
      return pageX >= slotRect.x
        && pageX <= slotRect.x + slotRect.width
        && pageY >= slotRect.y
        && pageY <= slotRect.y + slotRect.height;
    });
  }

  async function finishDrag(cardIndex: number, pageX: number, pageY: number) {
    const targetSlotIndex = await findDropSlotIndex(pageX, pageY);
    if (targetSlotIndex >= 0) {
      placeCardIntoSlot(cardIndex, targetSlotIndex);
    }

    draggingCardIndexRef.current = null;
    boardWindowOriginRef.current = null;
    setDraggingCardIndex(null);
    dragPosition.setValue({ x: 0, y: 0 });
  }

  function submitOrderingAnswer() {
    if (locked || !canSubmitOrdering) return;
    setLocked(true);
    room.send("submitAnswer", { value: slotOrder as number[] });
  }

  function getCardPanResponder(cardIndex: number) {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => !locked,
      onMoveShouldSetPanResponder: () => !locked,
      onPanResponderGrant: (event) => {
        beginDrag(cardIndex, event.nativeEvent.pageX, event.nativeEvent.pageY);
      },
      onPanResponderMove: (_event, gestureState) => {
        if (draggingCardIndexRef.current !== cardIndex) return;
        const boardOrigin = boardWindowOriginRef.current;
        if (!boardOrigin) return;
        const size = cardSizesRef.current[cardIndex] ?? { width: 80, height: 64 };
        dragPosition.setValue({
          x: gestureState.moveX - boardOrigin.x - size.width / 2,
          y: gestureState.moveY - boardOrigin.y - size.height / 2,
        });
      },
      onPanResponderRelease: (_event, gestureState) => {
        if (draggingCardIndexRef.current !== cardIndex) return;
        void finishDrag(cardIndex, gestureState.moveX, gestureState.moveY);
      },
      onPanResponderTerminate: () => {
        if (draggingCardIndexRef.current !== cardIndex) return;
        draggingCardIndexRef.current = null;
        boardWindowOriginRef.current = null;
        setDraggingCardIndex(null);
        dragPosition.setValue({ x: 0, y: 0 });
      },
    });
  }

  function renderOrderingCard(cardIndex: number, location: "slot" | "bank", slotIndex?: number) {
    const cardLabel = options[cardIndex];
    const isDragging = draggingCardIndex === cardIndex;
    const panHandlers = getCardPanResponder(cardIndex).panHandlers;

    return (
      <View
        collapsable={false}
        ref={(value) => {
          cardRefs.current[cardIndex] = value;
        }}
        onLayout={(event: LayoutChangeEvent) => {
          const { width, height } = event.nativeEvent.layout;
          cardSizesRef.current[cardIndex] = { width, height };
        }}
        style={[styles.orderCardWrap, isDragging && styles.orderCardHidden]}
      >
        <View
          {...panHandlers}
          style={[
            styles.orderCard,
            location === "slot" && styles.orderCardPlaced,
            state.gameMode === "damage" && styles.damageOrderCard,
          ]}
        >
          {location === "slot" && slotIndex !== undefined ? (
            <Text style={styles.orderSlotNumber}>{slotIndex + 1}.</Text>
          ) : null}
          <Text style={styles.orderCardText}>{cardLabel}</Text>
        </View>
      </View>
    );
  }

  return (
    <Screen style={styles.screen} androidScale={ANDROID_GAME_UI_SCALE}>
      <PhaseTimer phaseEndsAt={state.phaseEndsAt} />
      <View style={[styles.layout, state.gameMode === "damage" && styles.damageLayout]}>
        <DamageHud state={state} myPlayerId={room.sessionId} />
        <View
          style={[
            styles.difficultyBadge,
            state.gameMode === "damage" && styles.damageDifficultyBadge,
            { borderColor: difficultyStyle.color, backgroundColor: difficultyStyle.backgroundColor },
          ]}
        >
          <Text style={[styles.difficultyBadgeText, { color: difficultyStyle.color }]}>
            {t(`difficulty.${q.difficulty}`)}
          </Text>
        </View>
        <View style={styles.questionMetaRow}>
          <Text style={styles.round}>
            {state.gameMode === "damage"
              ? t("damage.question", { current: state.currentRoundIndex + 1 })
              : t("question.round", { current: state.currentRoundIndex + 1, total: state.totalRounds })}
          </Text>
        </View>
        <View style={[styles.questionBlock, state.gameMode === "damage" && styles.damageQuestionBlock]}>
          <Title>{q.text}</Title>
        </View>

        <View style={[styles.answerSection, state.gameMode === "damage" && styles.damageAnswerSection]}>
          {isFreeTextQuestion ? (
            <View style={[styles.freeAnswerWrap, state.gameMode === "damage" && styles.damageAnswerWrap]}>
              <Text style={styles.answerLabel}>{t("question.answerLabel")}</Text>
              <TextInput
                style={[styles.answerInput, state.gameMode === "damage" && styles.damageAnswerInput]}
                placeholder={isNumericFreeTextQuestion ? t("question.estimatePlaceholder") as string : t("question.wordPlaceholder") as string}
                placeholderTextColor={theme.textDim}
                value={freeAnswer}
                onChangeText={(value) => {
                  setFreeAnswer(value);
                  room.send("saveAnswerDraft", { value });
                }}
                editable={!locked}
                keyboardType={isNumericFreeTextQuestion ? "number-pad" : "default"}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={isNumericFreeTextQuestion ? 12 : 32}
              />
              {locked ? (
                <View style={[styles.statusRow, styles.inlineStatus]}>
                  <Text style={styles.lockedText}>{t("question.locked")}</Text>
                </View>
              ) : (
                <BigButton
                  label={t("question.submit")}
                  onPress={submitFreeAnswer}
                  soundEffect="answerLocked"
                  disabled={!canSubmitFreeAnswer}
                  style={[styles.submitButton, state.gameMode === "damage" && styles.damageSubmitButton]}
                />
              )}
            </View>
          ) : isOrderingQuestion ? (
            <View ref={boardRef} collapsable={false} style={[styles.orderingWrap, state.gameMode === "damage" && styles.damageAnswerWrap]}>
              <View style={styles.orderSlotsWrap}>
                {slotOrder.map((cardIndex, slotIndex) => (
                  <View
                    key={`${q.id}-slot-${slotIndex}`}
                    ref={(value) => {
                      slotRefs.current[slotIndex] = value;
                    }}
                    collapsable={false}
                    style={[styles.orderSlot, state.gameMode === "damage" && styles.damageOrderSlot]}
                  >
                    {cardIndex !== null ? renderOrderingCard(cardIndex, "slot", slotIndex) : null}
                  </View>
                ))}
              </View>

              {locked ? (
                <View style={[styles.statusRow, styles.inlineStatus]}>
                  <Text style={styles.lockedText}>{t("question.locked")}</Text>
                </View>
              ) : (
                <BigButton
                  label={t("question.submit")}
                  onPress={submitOrderingAnswer}
                  soundEffect="answerLocked"
                  disabled={!canSubmitOrdering}
                  style={[styles.submitButton, state.gameMode === "damage" && styles.damageSubmitButton]}
                />
              )}
              <BigButton
                label={t("question.resetOrder")}
                onPress={() => setSlotOrder(options.map((_, index) => index).sort(() => Math.random() - 0.5))}
                disabled={slotOrder.length === 0 || locked}
                variant="secondary"
                style={[styles.submitButton, state.gameMode === "damage" && styles.damageSubmitButton]}
              />

              {draggingCardIndex !== null ? (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.dragOverlayCard,
                    {
                      width: draggingCardSize.width,
                      minHeight: draggingCardSize.height,
                      transform: dragPosition.getTranslateTransform(),
                    },
                  ]}
                >
                  <Text style={styles.orderCardText}>{options[draggingCardIndex]}</Text>
                </Animated.View>
              ) : null}
            </View>
          ) : (
            <ScrollView
              horizontal
              style={styles.optionsScroll}
              contentContainerStyle={styles.options}
              showsHorizontalScrollIndicator={false}
            >
              {options.map((opt, index) => (
                <BigButton
                  key={`${q.id}-${index}`}
                  label={opt}
                  onPress={() => submit(index)}
                  soundEffect="answerLocked"
                  variant={selected === index ? "primary" : "secondary"}
                  disabled={locked && selected !== index}
                  textStyle={[
                    options.length <= 2 ? styles.binaryOptionText : styles.optionText,
                    state.gameMode === "damage" && styles.damageOptionText,
                  ]}
                  style={[
                    styles.optionButton,
                    options.length <= 2
                      ? styles.optionButtonTwoUp
                      : options.length === 3
                        ? styles.optionButtonThreeUp
                        : styles.optionButtonFourUp,
                    state.gameMode === "damage" && styles.damageOptionButton,
                    index < options.length - 1 && styles.optionButtonGap,
                  ]}
                />
              ))}
            </ScrollView>
          )}
        </View>
        <View style={styles.statusRow}>
          {locked && !isFreeTextQuestion && !isOrderingQuestion ? (
            <Text style={styles.lockedText}>{t("question.locked")}</Text>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    justifyContent: "flex-start",
    paddingTop: 0,
    ...(Platform.OS === "android" ? { maxWidth: 820, paddingHorizontal: 10 } : {}),
  },
  layout: {
    flex: 1,
    width: "100%",
    justifyContent: "flex-start",
    paddingTop: 24,
    paddingBottom: 12,
  },
  damageLayout: { paddingTop: 8, paddingBottom: 4 },
  questionMetaRow: {
    width: "100%", flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 14, marginBottom: 8,
  },
  round: { color: theme.textDim, textAlign: "center", fontWeight: "600" },
  difficultyBadge: {
    position: "absolute",
    top: 12,
    right: 58,
    zIndex: 2,
    minWidth: 76,
    alignItems: "center",
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  difficultyBadgeText: {
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  damageDifficultyBadge: { top: undefined, right: 2, bottom: 2, minWidth: 64, paddingHorizontal: 7, paddingVertical: 3 },
  questionBlock: {
    width: "100%",
    minHeight: 92,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  damageQuestionBlock: { minHeight: 62, paddingHorizontal: 12, marginBottom: 4 },
  answerSection: {
    flex: 1,
    width: "100%",
  },
  damageAnswerSection: { minHeight: 0 },
  statusRow: {
    minHeight: 28,
    justifyContent: "center",
  },
  inlineStatus: {
    width: "100%",
    maxWidth: 520,
    minHeight: 52,
    paddingHorizontal: 12,
  },
  optionsScroll: {
    width: "100%",
    flex: 1,
  },
  options: {
    width: "100%",
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 8,
  },
  optionButton: {
    minWidth: 0,
    alignSelf: "center",
    justifyContent: "center",
    marginTop: 0,
    paddingVertical: 10,
  },
  damageOptionButton: { height: 76, paddingVertical: 2, borderRadius: 10 },
  optionButtonTwoUp: {
    width: "34%",
    height: 96,
  },
  optionButtonThreeUp: {
    width: "28%",
    height: 104,
  },
  optionButtonFourUp: {
    width: "21%",
    height: 112,
  },
  optionText: { fontSize: 20, lineHeight: 24 },
  binaryOptionText: { fontSize: 24, lineHeight: 28 },
  damageOptionText: { fontSize: 16, lineHeight: 19, paddingHorizontal: 4 },
  optionButtonGap: {
    marginRight: 10,
  },
  freeAnswerWrap: { width: "100%", alignItems: "center", paddingTop: 8 },
  orderingWrap: { width: "100%", alignItems: "center", paddingTop: 8 },
  damageAnswerWrap: { paddingTop: 0 },
  answerLabel: {
    width: "100%",
    maxWidth: 520,
    color: theme.textDim,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  orderSlotsWrap: {
    width: "92%",
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "stretch",
  },
  orderSlot: {
    width: "24%",
    minHeight: Platform.OS === "android" ? 80 : 64,
    maxHeight: Platform.OS === "android" ? 80 : 64,
    backgroundColor: theme.surface,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "rgba(124, 92, 255, 0.28)",
    justifyContent: "center",
    overflow: "hidden",
  },
  damageOrderSlot: { minHeight: 56, maxHeight: 56 },
  orderCardWrap: {
    width: "100%",
    height: "100%",
  },
  orderCard: {
    minHeight: Platform.OS === "android" ? 76 : 60,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2A2245",
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderWidth: 2,
    borderColor: theme.primary,
  },
  damageOrderCard: { minHeight: 52, paddingVertical: 3 },
  orderCardPlaced: {
    width: "100%",
  },
  orderCardHidden: {
    opacity: 0.14,
  },
  orderSlotNumber: {
    color: theme.primary,
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 4,
  },
  orderCardText: {
    color: theme.text,
    fontSize: 11,
    lineHeight: 13,
    flexShrink: 1,
    textAlign: "center",
  },
  dragOverlayCard: {
    position: "absolute",
    left: 0,
    top: 0,
    zIndex: 30,
    backgroundColor: "#3A2F66",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.primary,
    paddingHorizontal: 2,
    paddingVertical: 2,
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  answerInput: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: "#2A2245",
    color: theme.text,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.primary,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 56,
    fontSize: 18,
    marginBottom: 12,
    textAlign: "left",
  },
  damageAnswerInput: { minHeight: 44, paddingVertical: 8, marginBottom: 5 },
  submitButton: { width: "100%", maxWidth: 520 },
  damageSubmitButton: { paddingVertical: 7, marginTop: 5 },
  lockedText: { color: theme.textDim, textAlign: "center" },
});
