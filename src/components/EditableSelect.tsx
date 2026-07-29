import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { TextInput } from '@/src/components/AppTextInput';
import { colors } from '@/src/theme/colors';

type EditableSelectProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  options: string[];
  placeholder?: string;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardType?: 'default' | 'numeric';
};

// Campo desplegable EDITABLE (combobox): se puede escribir libremente o elegir
// una opción de la lista. La lista se abre con la flecha y se filtra por lo que
// ya está escrito; si no hay coincidencias, muestra todas las opciones.
export function EditableSelect({
  label,
  value,
  onChangeText,
  options,
  placeholder,
  autoCapitalize = 'characters',
  keyboardType,
}: EditableSelectProps) {
  const [open, setOpen] = useState(false);

  const term = value.trim().toLowerCase();
  const coincidencias = term ? options.filter((opt) => opt.toLowerCase().includes(term)) : options;
  const lista = coincidencias.length > 0 ? coincidencias : options;

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          autoCapitalize={autoCapitalize}
          keyboardType={keyboardType}
          onChangeText={onChangeText}
          onFocus={() => setOpen(false)}
          placeholder={placeholder ?? label}
          placeholderTextColor="#98A2B3"
          style={styles.input}
          value={value}
        />
        <Pressable hitSlop={8} onPress={() => setOpen((prev) => !prev)} style={styles.chevronButton}>
          <Ionicons color="#98A2B3" name={open ? 'chevron-up' : 'chevron-down'} size={20} />
        </Pressable>
      </View>

      {open ? (
        <View style={styles.dropdown}>
          <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled style={styles.dropdownScroll}>
            {lista.map((opt) => {
              const activo = opt.toLowerCase() === term;
              return (
                <Pressable
                  key={opt}
                  onPress={() => {
                    onChangeText(opt);
                    setOpen(false);
                  }}
                  style={styles.option}>
                  <Text style={[styles.optionText, activo && styles.optionTextActive]}>{opt}</Text>
                  {activo ? <Ionicons color={colors.brand} name="checkmark" size={18} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: 12,
  },
  fieldLabel: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 6,
  },
  inputRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 52,
    paddingRight: 10,
  },
  input: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    color: colors.ink,
    flex: 1,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  chevronButton: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  dropdown: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 6,
    overflow: 'hidden',
  },
  dropdownScroll: {
    maxHeight: 220,
  },
  option: {
    alignItems: 'center',
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  optionText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '600',
  },
  optionTextActive: {
    color: colors.brand,
    fontWeight: '800',
  },
});
