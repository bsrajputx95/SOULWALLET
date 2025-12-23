import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Rect, Line } from 'react-native-svg';
import { COLORS } from '../constants/colors';

interface CandleData {
    open: number;
    high: number;
    low: number;
    close: number;
}

interface SimpleCandlestickChartProps {
    data: CandleData[];
    height?: number;
    positiveColor?: string;
    negativeColor?: string;
}

export const SimpleCandlestickChart: React.FC<SimpleCandlestickChartProps> = ({
    data,
    height = 200,
    positiveColor = COLORS.success,
    negativeColor = COLORS.error,
}) => {
    if (!data || data.length === 0) {
        return <View style={[styles.container, { height }]} />;
    }

    const width = Dimensions.get('window').width - 48; // Account for padding
    const candleWidth = Math.max(2, (width / data.length) * 0.7);
    const candleSpacing = width / data.length;

    // Calculate price range
    const allPrices = data.flatMap(d => [d.high, d.low]);
    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);
    const priceRange = maxPrice - minPrice || 1;

    // Scale price to Y coordinate (inverted - higher price = lower Y)
    const scaleY = (price: number) => {
        return ((maxPrice - price) / priceRange) * (height - 20) + 10;
    };

    return (
        <View style={[styles.container, { height }]}>
            <Svg width={width} height={height}>
                {data.map((candle, index) => {
                    const x = index * candleSpacing + candleSpacing / 2;
                    const isPositive = candle.close >= candle.open;
                    const color = isPositive ? positiveColor : negativeColor;

                    const bodyTop = scaleY(Math.max(candle.open, candle.close));
                    const bodyBottom = scaleY(Math.min(candle.open, candle.close));
                    const bodyHeight = Math.max(1, bodyBottom - bodyTop);

                    const wickTop = scaleY(candle.high);
                    const wickBottom = scaleY(candle.low);

                    return (
                        <React.Fragment key={index}>
                            {/* Wick (high to low line) */}
                            <Line
                                x1={x}
                                y1={wickTop}
                                x2={x}
                                y2={wickBottom}
                                stroke={color}
                                strokeWidth={1}
                            />
                            {/* Body (open to close rectangle) */}
                            <Rect
                                x={x - candleWidth / 2}
                                y={bodyTop}
                                width={candleWidth}
                                height={bodyHeight}
                                fill={isPositive ? color : color}
                                stroke={color}
                                strokeWidth={0.5}
                            />
                        </React.Fragment>
                    );
                })}
            </Svg>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
    },
});

export default SimpleCandlestickChart;
