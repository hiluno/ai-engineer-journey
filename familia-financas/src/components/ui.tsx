import React from 'react';
import {
  Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View, type TextInputProps, type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { monthLabel, shiftMonth } from '../lib/format';
import type { AlertLevel } from '../lib/types';

export const colors = {
  bg: '#F4F6FA',
  card: '#FFFFFF',
  text: '#1B2333',
  muted: '#6B7486',
  border: '#E2E6EE',
  primary: '#2F6FEB',
  primarySoft: '#E7EFFE',
  income: '#14915F',
  expense: '#D2453B',
  warning: '#C77700',
  warningSoft: '#FFF4E0',
  dangerSoft: '#FDECEA',
  successSoft: '#E5F6EE',
  infoSoft: '#EEF2F8',
};

export const levelColors: Record<AlertLevel, { fg: string; bg: string; icon: string }> = {
  danger: { fg: colors.expense, bg: colors.dangerSoft, icon: '⛔' },
  warning: { fg: colors.warning, bg: colors.warningSoft, icon: '⚠️' },
  success: { fg: colors.income, bg: colors.successSoft, icon: '✅' },
  info: { fg: colors.primary, bg: colors.infoSoft, icon: '💡' },
};

export function Screen({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 + insets.bottom, gap: 12 }}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Title({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={styles.titleRow}>
      <Text style={styles.title}>{children}</Text>
      {right}
    </View>
  );
}

export function Muted({ children, style }: { children: React.ReactNode; style?: object }) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

export function Button({
  label, onPress, variant = 'primary', small, disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  small?: boolean;
  disabled?: boolean;
}) {
  const bg = variant === 'primary' ? colors.primary : variant === 'danger' ? colors.dangerSoft : colors.primarySoft;
  const fg = variant === 'primary' ? '#fff' : variant === 'danger' ? colors.expense : colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
      ]}
    >
      <Text style={[styles.buttonText, small && { fontSize: 13 }, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, hint, ...props }: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={{ gap: 4, flex: 1 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor="#A0A7B5" style={styles.input} {...props} />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Row({ children, gap = 8, style }: { children: React.ReactNode; gap?: number; style?: ViewStyle }) {
  return <View style={[{ flexDirection: 'row', gap, alignItems: 'flex-start' }, style]}>{children}</View>;
}

export function Chips<T extends string>({
  options, value, onChange, label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label?: string;
}) {
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.chips}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={[styles.titleRow, { paddingVertical: 4 }]}>
      <Text style={[styles.label, { flex: 1 }]}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary, false: colors.border }} />
    </View>
  );
}

export function ProgressBar({ pct, color }: { pct: number; color?: string }) {
  const c = color ?? (pct >= 100 ? colors.expense : pct >= 80 ? colors.warning : colors.income);
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${Math.min(100, Math.max(0, pct))}%`, backgroundColor: c }]} />
    </View>
  );
}

export function MonthPicker({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  return (
    <View style={styles.monthPicker}>
      <Pressable hitSlop={12} onPress={() => onChange(shiftMonth(month, -1))} accessibilityLabel="Mês anterior">
        <Text style={styles.monthArrow}>‹</Text>
      </Pressable>
      <Text style={styles.monthText}>{monthLabel(month)}</Text>
      <Pressable hitSlop={12} onPress={() => onChange(shiftMonth(month, 1))} accessibilityLabel="Mês seguinte">
        <Text style={styles.monthArrow}>›</Text>
      </Pressable>
    </View>
  );
}

export function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={[styles.stat, color ? { color } : null]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

export function Notice({ level, title, message }: { level: AlertLevel; title: string; message: string }) {
  const c = levelColors[level];
  return (
    <View style={[styles.notice, { backgroundColor: c.bg }]}>
      <Text style={{ fontSize: 16 }}>{c.icon}</Text>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.noticeTitle, { color: c.fg }]}>{title}</Text>
        <Text style={styles.noticeText}>{message}</Text>
      </View>
    </View>
  );
}

export function Divider() {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 4 }} />;
}

export const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { fontSize: 17, fontWeight: '700', color: colors.text, flexShrink: 1 },
  muted: { fontSize: 13, color: colors.muted },
  label: { fontSize: 13, fontWeight: '600', color: colors.text },
  hint: { fontSize: 12, color: colors.muted },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
    backgroundColor: '#FBFCFE',
  },
  button: { borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  buttonSmall: { paddingVertical: 6, paddingHorizontal: 10 },
  buttonText: { fontSize: 15, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.infoSoft,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.text },
  chipTextActive: { color: colors.primary, fontWeight: '700' },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: colors.infoSoft, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4 },
  monthPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  monthArrow: { fontSize: 28, color: colors.primary, fontWeight: '600', lineHeight: 30 },
  monthText: { fontSize: 16, fontWeight: '700', color: colors.text },
  stat: { fontSize: 19, fontWeight: '800', color: colors.text },
  notice: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 12, alignItems: 'flex-start' },
  noticeTitle: { fontSize: 14, fontWeight: '700' },
  noticeText: { fontSize: 13, color: colors.text },
});
