import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';

const SIZE = 240;
const CENTER_Y = SIZE / 2;
const CIRCLE_R = 70;
const OVERLAP = 30; // 겹침 정도

/**
 * 취향 벤다이어그램 (나 vs 상대방)
 * @param {Object} props
 * @param {string} props.myName
 * @param {string} props.otherName
 * @param {string[]} props.myOnly - 나만 가진 취향
 * @param {string[]} props.otherOnly - 상대만 가진 취향
 * @param {string[]} props.shared - 공통 취향
 */
export default function VennDiagram({ myName = '나', otherName = '상대', myOnly = [], otherOnly = [], shared = [] }) {
  const leftX = SIZE / 2 - OVERLAP;
  const rightX = SIZE / 2 + OVERLAP;

  return (
    <View style={styles.container}>
      <Svg width={SIZE} height={SIZE}>
        {/* 왼쪽 원 (나) */}
        <Circle cx={leftX} cy={CENTER_Y} r={CIRCLE_R} fill="#6C5CE7" fillOpacity={0.2} stroke="#6C5CE7" strokeWidth={2} />
        {/* 오른쪽 원 (상대) */}
        <Circle cx={rightX} cy={CENTER_Y} r={CIRCLE_R} fill="#00B894" fillOpacity={0.2} stroke="#00B894" strokeWidth={2} />

        {/* 왼쪽 라벨 (나) */}
        <SvgText x={leftX - 35} y={40} fontSize={13} fontWeight="bold" fill="#6C5CE7" textAnchor="middle">
          {myName}
        </SvgText>

        {/* 오른쪽 라벨 (상대) */}
        <SvgText x={rightX + 35} y={40} fontSize={13} fontWeight="bold" fill="#00B894" textAnchor="middle">
          {otherName}
        </SvgText>

        {/* 나만의 취향 */}
        {myOnly.slice(0, 4).map((t, i) => (
          <SvgText key={`my-${i}`} x={leftX - 30} y={CENTER_Y - 25 + i * 18} fontSize={11} fill="#6C5CE7" textAnchor="middle">
            {t}
          </SvgText>
        ))}

        {/* 공통 취향 */}
        {shared.slice(0, 4).map((t, i) => (
          <SvgText key={`shared-${i}`} x={SIZE / 2} y={CENTER_Y - 25 + i * 18} fontSize={11} fontWeight="bold" fill="#333" textAnchor="middle">
            {t}
          </SvgText>
        ))}

        {/* 상대만의 취향 */}
        {otherOnly.slice(0, 4).map((t, i) => (
          <SvgText key={`other-${i}`} x={rightX + 30} y={CENTER_Y - 25 + i * 18} fontSize={11} fill="#00B894" textAnchor="middle">
            {t}
          </SvgText>
        ))}
      </Svg>

      {/* 공통 취향 수 */}
      <View style={styles.sharedBadge}>
        <Text style={styles.sharedCount}>{shared.length}개</Text>
        <Text style={styles.sharedLabel}>공통 취향</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: 8 },
  sharedBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  sharedCount: { fontSize: 18, fontWeight: 'bold', color: '#6C5CE7', marginRight: 4 },
  sharedLabel: { fontSize: 13, color: '#888' },
});
