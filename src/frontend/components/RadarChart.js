import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polygon, Line, Circle, Text as SvgText } from 'react-native-svg';

const SIZE = 220;
const CENTER = SIZE / 2;
const RADIUS = 80;
const LEVELS = 4;

/**
 * 취향 레이더 차트 (오각형+)
 * @param {Object} props
 * @param {Array<{label: string, value: number}>} props.data - 각 축 (0~100)
 * @param {string} [props.color='#6C5CE7']
 * @param {string} [props.title]
 */
export default function RadarChart({ data = [], color = '#6C5CE7', title }) {
  const count = data.length;
  if (count < 3) return null;

  const angleStep = (2 * Math.PI) / count;

  // 꼭짓점 좌표 계산 (12시 방향 시작)
  const getPoint = (index, value) => {
    const angle = angleStep * index - Math.PI / 2;
    const r = (value / 100) * RADIUS;
    return {
      x: CENTER + r * Math.cos(angle),
      y: CENTER + r * Math.sin(angle),
    };
  };

  // 배경 격자 다각형
  const gridPolygons = [];
  for (let level = 1; level <= LEVELS; level++) {
    const r = (level / LEVELS) * 100;
    const points = data.map((_, i) => {
      const p = getPoint(i, r);
      return `${p.x},${p.y}`;
    }).join(' ');
    gridPolygons.push(points);
  }

  // 데이터 다각형
  const dataPoints = data.map((d, i) => {
    const p = getPoint(i, d.value);
    return `${p.x},${p.y}`;
  }).join(' ');

  // 축 라벨 위치
  const labelPoints = data.map((d, i) => {
    const angle = angleStep * i - Math.PI / 2;
    const labelR = RADIUS + 28;
    return {
      x: CENTER + labelR * Math.cos(angle),
      y: CENTER + labelR * Math.sin(angle),
      label: d.label,
    };
  });

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}
      <Svg width={SIZE} height={SIZE}>
        {/* 배경 격자 */}
        {gridPolygons.map((points, i) => (
          <Polygon
            key={`grid-${i}`}
            points={points}
            fill="none"
            stroke="#E0E0E0"
            strokeWidth={1}
          />
        ))}

        {/* 축 선 */}
        {data.map((_, i) => {
          const p = getPoint(i, 100);
          return (
            <Line
              key={`axis-${i}`}
              x1={CENTER} y1={CENTER}
              x2={p.x} y2={p.y}
              stroke="#E0E0E0" strokeWidth={1}
            />
          );
        })}

        {/* 데이터 영역 */}
        <Polygon
          points={dataPoints}
          fill={color}
          fillOpacity={0.25}
          stroke={color}
          strokeWidth={2}
        />

        {/* 데이터 포인트 */}
        {data.map((d, i) => {
          const p = getPoint(i, d.value);
          return (
            <Circle
              key={`dot-${i}`}
              cx={p.x} cy={p.y} r={4}
              fill={color}
            />
          );
        })}

        {/* 축 라벨 */}
        {labelPoints.map((lp, i) => (
          <SvgText
            key={`label-${i}`}
            x={lp.x} y={lp.y}
            fontSize={11}
            fontWeight="600"
            fill="#555"
            textAnchor="middle"
            alignmentBaseline="middle"
          >
            {lp.label}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: 8 },
  title: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 8 },
});
