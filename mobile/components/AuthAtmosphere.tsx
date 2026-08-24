import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, type ReactNode } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, Path, RadialGradient, Stop } from 'react-native-svg';

const { width: W, height: H } = Dimensions.get('window');

/** Soft evening grove — brand atmosphere behind login / OTP. */
export function AuthAtmosphere() {
  const glow = useSharedValue(0.55);
  const drift = useSharedValue(0);

  useEffect(() => {
    glow.value = withRepeat(
      withTiming(0.85, { duration: 4200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    drift.value = withRepeat(
      withTiming(1, { duration: 14000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [glow, drift]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [{ scale: 0.92 + glow.value * 0.12 }],
  }));

  const driftStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: drift.value * -18 }],
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={['#15241c', '#1f3328', '#2a3f32', '#24352c']}
        locations={[0, 0.35, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View style={[styles.glowWrap, glowStyle]}>
        <LinearGradient
          colors={['transparent', 'rgba(212,165,116,0.18)', 'rgba(232,213,163,0.28)']}
          style={styles.glow}
        />
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, driftStyle]}>
        <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="moon" cx="70%" cy="18%" r="28%">
              <Stop offset="0%" stopColor="#f5e6c8" stopOpacity="0.35" />
              <Stop offset="55%" stopColor="#d4a574" stopOpacity="0.08" />
              <Stop offset="100%" stopColor="#15241c" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Ellipse cx={W * 0.72} cy={H * 0.14} rx={W * 0.34} ry={H * 0.16} fill="url(#moon)" />
          {/* Quiet vine arches — family tree echo, not decoration clutter */}
          <Path
            d={`M ${-20} ${H * 0.62} C ${W * 0.2} ${H * 0.48}, ${W * 0.35} ${H * 0.55}, ${W * 0.48} ${H * 0.72}`}
            stroke="rgba(201,180,154,0.22)"
            strokeWidth={1.5}
            fill="none"
          />
          <Path
            d={`M ${W + 20} ${H * 0.58} C ${W * 0.78} ${H * 0.44}, ${W * 0.62} ${H * 0.52}, ${W * 0.52} ${H * 0.7}`}
            stroke="rgba(201,180,154,0.18)"
            strokeWidth={1.5}
            fill="none"
          />
          <Circle cx={W * 0.18} cy={H * 0.28} r={2.2} fill="rgba(245,230,200,0.35)" />
          <Circle cx={W * 0.88} cy={H * 0.36} r={1.6} fill="rgba(245,230,200,0.28)" />
          <Circle cx={W * 0.42} cy={H * 0.22} r={1.4} fill="rgba(245,230,200,0.22)" />
        </Svg>
      </Animated.View>
    </View>
  );
}

/** Fade / rise entrance for auth content. */
export function AuthEntrance({
  children,
  delay = 0,
  style,
}: {
  children: ReactNode;
  delay?: number;
  style?: object;
}) {
  const opacity = useSharedValue(0);
  const y = useSharedValue(22);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }),
    );
    y.value = withDelay(
      delay,
      withTiming(0, { duration: 700, easing: Easing.out(Easing.cubic) }),
    );
  }, [delay, opacity, y]);

  const anim = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: y.value }],
  }));

  return <Animated.View style={[anim, style]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  glowWrap: {
    position: 'absolute',
    left: -W * 0.2,
    right: -W * 0.2,
    bottom: -H * 0.05,
    height: H * 0.55,
  },
  glow: {
    flex: 1,
    borderRadius: W,
  },
});
