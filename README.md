# Flistaile

Jogo incremental (clicker/idle) no estilo Clicker Heroes / Taskbar Heroes. **Flistaile** é um guardião que luta com **dois escudos**, um em cada braço, e vai esmagando criaturas por nove regiões até o Abismo Eterno.

Site: https://flistaile.galorakdev.com/

## Como jogar

- **Clique na arena** para golpear com o escudo (dano por clique).
- Derrote **10 criaturas** para liberar a próxima zona. A cada **5 zonas** aparece um **chefe** com tempo limite; se ele vencer, você volta uma zona para farmar (ligue "Avançar" quando estiver mais forte).
- **Treinos**: aumentam o golpe e o DPS automático (escudos espectrais). A cada 25 níveis o treino dobra de força.
- **Atributos**: Precisão (crítico), Impacto Esmagador (dano crítico), Ganância (ouro) e Sinergia (golpe ganha parte do DPS).
- **Escudos**: forje o Escudo Esquerdo (multiplica o golpe) e o Escudo Direito (multiplica o DPS) de Madeira até Eterno. Manter os dois no mesmo nível dá o bônus de **Harmonia**.
- **10 habilidades** (teclas 1–9 e 0): Fúria Dupla, Rajada, Olho do Falcão, Chuva de Ouro, Impacto Sísmico, Grito de Guerra, Muralha do Tempo, Ímã de Tesouros, Eco Temporal e Ascensão Gêmea.
- **Renascer** (zona 30+): recomeça da zona 1 e ganha **Égides** — cada uma dá +10% de dano e compra **Relíquias** permanentes.
- **Gemas**: todo chefe derrotado pela primeira vez dá uma gema (e às vezes chefes e Baús Vivos também). Com gemas você contrata até 10 **Escudeiros** (auto clickers): arraste cada um até o monstro, uma habilidade ou um item da loja e ele fica apertando ali. Clique num Escudeiro para recolhê-lo. Gemas e Escudeiros ficam após renascer.
- **40 conquistas**, cada uma com +3% de dano (algumas dão gemas).
- **Chefe final**: o Devorador de Mundos, na zona 500, conclui a história. Depois disso as zonas continuam.
- Baús Vivos aparecem de vez em quando e dão muito ouro.
- O jogo continua rendendo ouro com a aba fechada (até 12h).

## Balanceamento

Os parâmetros ficam em `BAL` no topo de `assets/game.js`. O simulador em `tools/sim.html` roda um jogador robô com as fórmulas reais do jogo e mede o tempo até cada zona; `tools/simworker.js` roda várias combinações em paralelo. Na configuração atual o robô (compras ótimas, 6 cliques/s) derrota o chefe final em ~75h — um jogador humano deve levar perto de 100h.

O progresso fica salvo no navegador (localStorage) e pode ser exportado/importado em **Opções**.

## Estrutura

Site estático, sem dependências nem build:

```
index.html
assets/style.css
assets/game.js   # lógica, economia e gráficos (canvas)
assets/icon.svg
```

## Rodar localmente

```
php -S 127.0.0.1:8095
```

(ou qualquer servidor de arquivos estáticos) e abra http://127.0.0.1:8095.

## Publicar

Envie os arquivos para a pasta pública do subdomínio na Hostinger (`public_html` do `flistaile.galorakdev.com`).
