const tf = require('@tensorflow/tfjs-node');
require('dotenv').config();

const modelUrl = process.env.MODEL_URL;

async function predict(inputData) {
  const model = await tf.loadLayersModel(modelUrl);

  const scaler = (data) => {
    const mean = [
      1.43478261, 44.1594203, 5.84057971, 6.63043478, 7.10144928, 59.442029,
      5.63768116, 1.65217391, 70.9202899, 6850.72464, 131.275362, 86.8333333,
    ];
    const variance = [
      0.245746692, 75.3803823, 6.23545474, 0.653276623, 1.61289645, 441.7249,
      3.46292796, 0.299306868, 19.392197, 3121919.76, 58.9096828, 40.486715,
    ];
    return data.map((row) =>
      row.map(
        (value, index) => (value - mean[index]) / Math.sqrt(variance[index])
      )
    );
  };

  const scaledData = tf.tensor2d(scaler(inputData));

  const predictions = model.predict(scaledData);
  const predictionsArray = Array.from(predictions.dataSync());
  const predictedClass = predictions.argMax(-1).dataSync()[0] + 1;
  const confidencePercentages = predictionsArray.map((p) =>
    (p * 100).toFixed(2)
  );

  return { predictedClass, confidencePercentages };
}

module.exports = { predict };
