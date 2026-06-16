export const validateRut = (rut: string): boolean => {
  // Clear any formatting first (dots, hyphens, spaces)
  const cleanRut = rut.replace(/\./g, '').replace(/ /g, '').replace(/-/g, '');
  if (!/^[0-9]+[0-9kK]{1}$/.test(cleanRut)) return false;
  
  const num = cleanRut.slice(0, -1);
  const dv = cleanRut.slice(-1);
  if (!num || !dv) return false;
  
  let total = 0;
  let factor = 2;
  for (let i = num.length - 1; i >= 0; i--) {
    total += parseInt(num[i], 10) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  
  const expectedDv = 11 - (total % 11);
  const calculatedDv = expectedDv === 11 ? '0' : expectedDv === 10 ? 'K' : expectedDv.toString();
  return calculatedDv.toUpperCase() === dv.toUpperCase();
};

export const validateEmail = (email: string): boolean => {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
};
