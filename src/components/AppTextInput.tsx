import { forwardRef } from 'react';
import { TextInput as RNTextInput, TextInputProps } from 'react-native';

// Los tecnicos reportaron que el autocorrector del teclado les hacia fallar
// al buscar/editar equipos (cambiaba lo que escribian). Este wrapper reemplaza
// al TextInput nativo en toda la app y fuerza autoCorrect/spellCheck apagados,
// sin importar lo que cada pantalla pase como prop.
export const TextInput = forwardRef<RNTextInput, TextInputProps>((props, ref) => (
  <RNTextInput ref={ref} {...props} autoCorrect={false} spellCheck={false} />
));

TextInput.displayName = 'TextInput';
