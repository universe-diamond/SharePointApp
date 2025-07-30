// --- Number Formatting Utility ---
/**
 * Formats a number with commas as thousands separators and optional decimal points.
 * @param {number} number - The number to format.
 * @param {number} points - Number of decimal points to show (default: 1).
 * @returns {string} - Formatted number as a string.
 */
const formatWithSpaces = (number, points = 1) => {
  if (typeof number !== "number" || isNaN(number)) return "0";

  if (number == parseInt(number)) number = parseInt(number);
  else {
    number = number.toFixed(points);
    if (number.endsWith(".0")) number = number.slice(0, -2);
  }

  if (isNaN(number)) return "";

  const [intPart, decimalPart] = number.toString().split(".");

  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return decimalPart !== undefined ? `${formattedInt}.${decimalPart}` : formattedInt;
};

export default formatWithSpaces;
