/**
 * Configuração do cliente.
 *
 * O endereço padrão aponta para a máquina local — é o que o `npm run dev` sobe.
 * Na tela inicial dá para trocar pelo endereço de um servidor na internet
 * (ws://IP:8790 ou wss://dominio), e a escolha fica guardada no localStorage.
 */

export const SERVIDOR_PADRAO = 'ws://localhost:8790';

/** Sensibilidade do mouse: radianos por pixel. */
export const SENSIBILIDADE = 0.0023;

/** Campo de visão padrão da câmera, em graus. */
export const FOV_PADRAO = 75;
