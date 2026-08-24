import { StyleSheet } from 'react-native';

/** Shared tokens for post-login auth screens (profile / family / join). */
export const auth = {
  bg: '#15241c',
  cream: '#f5e6c8',
  creamSoft: '#e8d5a3',
  creamMuted: 'rgba(232,213,163,0.72)',
  creamFaint: 'rgba(232,213,163,0.45)',
  creamDim: 'rgba(232,213,163,0.28)',
  amber: '#d4a574',
  ink: '#15241c',
  error: '#f0a8a0',
  ok: '#9dba8c',
};

export const authStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: auth.bg },
  flex: { flex: 1 },
  inner: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'space-between',
  },
  brandMark: {
    fontFamily: 'Fraunces_500Medium',
    fontSize: 15,
    color: 'rgba(232,213,163,0.55)',
    marginBottom: 10,
  },
  title: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 36,
    lineHeight: 42,
    color: auth.cream,
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 10,
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    lineHeight: 24,
    color: auth.creamMuted,
    maxWidth: 320,
  },
  label: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
    color: 'rgba(232,213,163,0.55)',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  inputShell: {
    borderBottomWidth: 1.5,
    borderBottomColor: auth.creamDim,
    paddingBottom: 10,
    marginTop: 6,
  },
  inputShellOn: { borderBottomColor: auth.amber },
  input: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 22,
    color: auth.cream,
    paddingVertical: 8,
  },
  helper: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: auth.creamFaint,
    marginTop: 6,
  },
  error: {
    fontFamily: 'DMSans_500Medium',
    color: auth.error,
    fontSize: 14,
    marginTop: 8,
  },
  ok: {
    fontFamily: 'DMSans_500Medium',
    color: auth.ok,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  button: {
    marginTop: 18,
    backgroundColor: auth.creamSoft,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonPressed: { transform: [{ scale: 0.985 }], opacity: 0.92 },
  buttonDisabled: { opacity: 0.38 },
  buttonText: {
    fontFamily: 'DMSans_700Bold',
    color: auth.ink,
    fontSize: 16,
    letterSpacing: 0.2,
  },
  ghost: {
    marginTop: 14,
    alignItems: 'center',
    paddingVertical: 10,
  },
  ghostText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 15,
    color: 'rgba(232,213,163,0.65)',
  },
  back: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 15,
    color: 'rgba(232,213,163,0.65)',
  },
});
