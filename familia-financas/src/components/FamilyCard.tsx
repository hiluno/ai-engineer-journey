import { useState } from 'react';
import { Alert, Platform, Pressable, Text, View } from 'react-native';

import { useData } from '../state/DataContext';
import { Button, Card, colors, Field, Muted, Row, styles, Title } from './ui';

/** Membros da família usados para identificar quem fez cada movimento. */
export function FamilyCard() {
  const { data, updateSettings, reset } = useData();
  const [name, setName] = useState('');
  const members = data.settings.members;

  const add = () => {
    const n = name.trim();
    if (!n || members.includes(n)) return;
    updateSettings({ members: [...members, n] });
    setName('');
  };

  const remove = (m: string) => {
    if (members.length <= 1) return;
    updateSettings({ members: members.filter((x) => x !== m) });
  };

  const confirmReset = () => {
    if (Platform.OS === 'web') return reset();
    Alert.alert('Apagar todos os dados?', 'Movimentos, orçamentos, metas e créditos serão eliminados deste telemóvel.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar tudo', style: 'destructive', onPress: reset },
    ]);
  };

  return (
    <Card>
      <Title>👨‍👩‍👧 Família</Title>
      <View style={styles.chips}>
        {members.map((m) => (
          <Pressable key={m} onLongPress={() => remove(m)} style={styles.chip}>
            <Text style={styles.chipText}>{m}</Text>
          </Pressable>
        ))}
      </View>
      <Row style={{ alignItems: 'flex-end' }}>
        <Field label="Adicionar membro" placeholder="Ex.: Ana" value={name} onChangeText={setName} onSubmitEditing={add} />
        <Button small label="Adicionar" onPress={add} />
      </Row>
      <Muted>Mantenha premido um nome para o remover. Os dados ficam guardados apenas neste telemóvel.</Muted>
      <Button small variant="danger" label="Apagar todos os dados" onPress={confirmReset} />
      <Text style={{ color: colors.muted, fontSize: 11, textAlign: 'center' }}>Finanças da Família · v1.0</Text>
    </Card>
  );
}
