const soDigitos = (v) => String(v ?? "").replace(/\D/g, "");

export function formatarCPF(v) {
  const d = soDigitos(v).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

export function formatarTelefone(v) {
  const d = soDigitos(v).slice(0, 11);
  if (d.length <= 10) return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}

export function formatarCNPJ(v) {
  return soDigitos(v)
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export const apenasDigitos = soDigitos;

// Validação dos dígitos verificadores do CPF.
export function cpfValido(v) {
  const d = soDigitos(v);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const digito = (base) => {
    let soma = 0;
    for (let i = 0; i < base; i++) soma += Number(d[i]) * (base + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(9) === Number(d[9]) && digito(10) === Number(d[10]);
}

// Liga uma máscara a um <input>.
export function aplicarMascara(input, formatador) {
  input.addEventListener("input", () => {
    input.value = formatador(input.value);
  });
}

// Marca o campo como inválido com mensagem em português (Constraint Validation API).
export function validarCampoCPF(input) {
  const validar = () =>
    input.setCustomValidity(!input.value || cpfValido(input.value) ? "" : "CPF inválido.");
  input.addEventListener("input", validar);
  validar();
}
