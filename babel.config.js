const isProduction = process.env.NODE_ENV === "production";

module.exports = {
  presets: ["@babel/preset-env"],
  plugins: isProduction ? ["transform-remove-console"] : [],
};
