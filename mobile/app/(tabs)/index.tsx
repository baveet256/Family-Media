import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/contexts/AuthContext';

export default function HomeScreen() {
  const router = useRouter();
  const { user, families, pendingJoinRequests } = useAuth();
  const family =
    families.find((f) => f.status === 'active') ??
    families.find((f) => f.role === 'admin') ??
    families[0];

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>Family Media</Text>
      <Text style={styles.title}>
        {family ? family.name : 'Your family home'}
      </Text>
      <Text style={styles.subtitle}>
        Hi {user?.displayName || 'there'} — Phase 1 family core is live.
      </Text>

      {family?.status === 'pending' ||
      (!family && pendingJoinRequests.length > 0) ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Waiting for approval</Text>
          <Text style={styles.detail}>
            Your join request is pending. Admins can see it now; approve/reject
            arrives in Phase 2.
          </Text>
        </View>
      ) : null}

      {family && family.status !== 'pending' ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Family</Text>
          <Text style={styles.detail}>
            Role: {family.role}
            {family.inviteCode ? ` · Code ${family.inviteCode}` : ''}
          </Text>

          {family.role === 'admin' && (
            <View style={styles.actions}>
              <Pressable
                style={styles.button}
                onPress={() =>
                  router.push({
                    pathname: '/family/invite',
                    params: { familyId: family.id },
                  })
                }>
                <Text style={styles.buttonText}>Invite</Text>
              </Pressable>
              <Pressable
                style={styles.secondary}
                onPress={() =>
                  router.push({
                    pathname: '/family/join-requests',
                    params: { familyId: family.id },
                  })
                }>
                <Text style={styles.secondaryText}>Join requests</Text>
              </Pressable>
            </View>
          )}
        </View>
      ) : null}

      {!family && pendingJoinRequests.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Get started</Text>
          <Text style={styles.detail}>
            Create a family or join with an invite code.
          </Text>
          <View style={styles.actions}>
            <Pressable
              style={styles.button}
              onPress={() => router.push('/(auth)/create-family')}>
              <Text style={styles.buttonText}>Create family</Text>
            </Pressable>
            <Pressable
              style={styles.secondary}
              onPress={() => router.push('/(auth)/join-code')}>
              <Text style={styles.secondaryText}>Join with code</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    paddingTop: 48,
    backgroundColor: '#fafafa',
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  title: {
    marginTop: 8,
    fontSize: 28,
    fontWeight: '700',
    color: '#111',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 16,
    color: '#666',
  },
  card: {
    marginTop: 28,
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detail: {
    marginTop: 10,
    fontSize: 15,
    color: '#444',
    lineHeight: 22,
  },
  actions: {
    marginTop: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#111',
  },
  buttonText: { color: '#fff', fontWeight: '700' },
  secondary: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#f3f3f3',
  },
  secondaryText: { color: '#111', fontWeight: '700' },
});
