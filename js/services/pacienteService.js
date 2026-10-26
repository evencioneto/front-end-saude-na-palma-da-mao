import { pacienteApi } from "./usuarioService.js";
import { toPaciente } from "../mappers/index.js";

export const pacienteService = {
  // Dados de leitura para o administrador (nome e situação vêm do usuário vinculado).
  async listar() {
    return (await pacienteApi.listar()).map(toPaciente);
  },
};
