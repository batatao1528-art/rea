using System;
using System.Collections.Generic;
using Atrasado.Core;
using Atrasado.Player;
using UnityEngine;
using UnityEngine.Pool;
using Random = UnityEngine.Random;

namespace Atrasado.Obstacles
{
    [Serializable]
    public class ObstacleType
    {
        public Obstacle prefab;
        [Min(0f)] public float weight = 1f;
        [Tooltip("Só aparece a partir desta dificuldade (0 = início, 1 = velocidade máxima).")]
        [Range(0f, 1f)] public float minDifficulty = 0f;
    }

    /// <summary>
    /// Geração aleatória JUSTA de obstáculos.
    ///
    /// Regras de justiça (o jogador só morre por culpa dele):
    /// 1. Um obstáculo por "linha": as duas calçadas nunca são bloqueadas juntas.
    /// 2. Se o próximo obstáculo está na calçada oposta ao anterior, o espaço livre
    ///    entre eles é sempre >= velocidade × (tempo de reação + tempo de troca),
    ///    usando a velocidade PREVISTA para quando eles chegarem ao jogador.
    /// 3. "Respiros" periódicos sem obstáculos para o cérebro relaxar.
    ///
    /// A aleatoriedade vem de padrões curtos (único, zigue-zague, parede), que dão
    /// ritmo e leitura em vez de ruído puro.
    /// </summary>
    public class ObstacleSpawner : MonoBehaviour
    {
        private enum Pattern { Single, ZigZag, Wall }

        [SerializeField] private ObstacleType[] types;
        [SerializeField] private PlayerLaneSwitcher player;

        [Header("Posições (z)")]
        [SerializeField] private float spawnZ = 60f;
        [SerializeField] private float despawnZ = -6f;
        [Tooltip("Primeiro obstáculo chega em ~2-3 s: o jogador entende o jogo sem tutorial.")]
        [SerializeField] private float firstObstacleZ = 22f;

        [Header("Justiça")]
        [Tooltip("Tempo de reação humano assumido (s). Não use menos que 0.25.")]
        [SerializeField] private float reactionTime = 0.3f;
        [Tooltip("Folga extra (s) no começo da partida; some conforme a dificuldade sobe.")]
        [SerializeField] private float easyExtraTime = 0.5f;
        [Tooltip("Profundidade (z) da hitbox do jogador.")]
        [SerializeField] private float playerDepth = 0.6f;
        [Tooltip("Espaço mínimo (m) entre obstáculos na mesma calçada (só legibilidade).")]
        [SerializeField] private float minSameLaneGap = 3f;
        [Tooltip("Espaço máximo extra aleatório (s) para quebrar a previsibilidade.")]
        [SerializeField] private float randomExtraTime = 0.35f;

        [Header("Ritmo")]
        [SerializeField] private float breatherEvery = 45f;
        [SerializeField] private float breatherDuration = 3f;
        [Tooltip("Ao continuar (anúncio), limpa obstáculos até esta distância.")]
        [SerializeField] private float reviveClearZ = 25f;

        public float DespawnZ => despawnZ;
        public IReadOnlyList<Obstacle> Active => active;

        private readonly List<Obstacle> active = new List<Obstacle>();
        private readonly Queue<int> pendingLanes = new Queue<int>();
        private readonly Dictionary<Obstacle, ObjectPool<Obstacle>> poolByPrefab = new Dictionary<Obstacle, ObjectPool<Obstacle>>();
        private readonly Dictionary<Obstacle, ObjectPool<Obstacle>> poolByInstance = new Dictionary<Obstacle, ObjectPool<Obstacle>>();

        private GameManager gm;
        private float distanceToNextSpawn;
        private float runTime;
        private float nextBreatherTime;
        private int lastLane;
        private int plannedLane;
        private ObstacleType plannedType;

        private void Start()
        {
            gm = GameManager.Instance;
            foreach (ObstacleType type in types)
            {
                Obstacle prefab = type.prefab;
                poolByPrefab[prefab] = new ObjectPool<Obstacle>(
                    createFunc: () => Instantiate(prefab, transform),
                    actionOnGet: o => o.gameObject.SetActive(true),
                    actionOnRelease: o => o.gameObject.SetActive(false),
                    defaultCapacity: 8);
            }

            gm.RunStarted += OnRunStarted;
            gm.RunReset += OnRunReset;
            gm.Revived += OnRevived;
            gm.BusReached += AddBreather;
        }

        private void OnDestroy()
        {
            if (gm == null) return;
            gm.RunStarted -= OnRunStarted;
            gm.RunReset -= OnRunReset;
            gm.Revived -= OnRevived;
            gm.BusReached -= AddBreather;
        }

        private void Update()
        {
            if (gm.State != GameState.Playing) return;

            runTime += Time.deltaTime;
            if (runTime >= nextBreatherTime)
            {
                nextBreatherTime += breatherEvery;
                AddBreather();
            }

            distanceToNextSpawn -= gm.Speed * Time.deltaTime;
            while (distanceToNextSpawn <= 0f)
            {
                // distanceToNextSpawn negativo = o mundo já andou além do ponto exato; compensa.
                SpawnPlannedAt(spawnZ + distanceToNextSpawn);
                distanceToNextSpawn += PlanNextAndGetGap();
            }
        }

        public void Despawn(Obstacle obstacle)
        {
            active.Remove(obstacle);
            poolByInstance[obstacle].Release(obstacle);
        }

        private void OnRunStarted()
        {
            runTime = 0f;
            nextBreatherTime = breatherEvery;
            lastLane = Random.Range(0, 2);
            plannedType = null;
            pendingLanes.Clear();
            PlanNextAndGetGap();

            // Pré-popula a rua do primeiro obstáculo até o horizonte.
            float z = firstObstacleZ;
            while (z <= spawnZ)
            {
                SpawnPlannedAt(z);
                z += PlanNextAndGetGap();
            }
            distanceToNextSpawn = z - spawnZ;
        }

        private void OnRunReset()
        {
            for (int i = active.Count - 1; i >= 0; i--) Despawn(active[i]);
        }

        private void OnRevived()
        {
            for (int i = active.Count - 1; i >= 0; i--)
            {
                if (active[i].FrontZ < reviveClearZ) Despawn(active[i]);
            }
        }

        private void AddBreather() => distanceToNextSpawn += gm.Speed * breatherDuration;

        private void SpawnPlannedAt(float z)
        {
            ObjectPool<Obstacle> pool = poolByPrefab[plannedType.prefab];
            Obstacle obstacle = pool.Get();
            poolByInstance[obstacle] = pool;

            // Obstáculos móveis nascem mais longe para chegar ao jogador no mesmo
            // instante que um parado chegaria — o ritmo planejado se mantém.
            float speed = Mathf.Max(gm.Speed, 0.01f);
            float arrivalZ = z * (speed + obstacle.OwnSpeed) / speed;

            obstacle.Activate(this, plannedLane, new Vector3(player.LaneX(plannedLane), 0f, arrivalZ));
            active.Add(obstacle);
            lastLane = plannedLane;
        }

        /// <summary>
        /// Escolhe o próximo obstáculo e devolve a distância (centro a centro) que ele
        /// precisa ficar do último gerado para ser justo.
        /// </summary>
        private float PlanNextAndGetGap()
        {
            ObstacleType previousType = plannedType;
            if (pendingLanes.Count == 0) EnqueuePattern();

            plannedLane = pendingLanes.Dequeue();
            plannedType = PickType();

            if (previousType == null) return 0f; // primeiro obstáculo da partida

            // Velocidade quando esses obstáculos chegarem ao jogador, não a de agora.
            float speedOnArrival = gm.SpeedAfter(spawnZ / Mathf.Max(gm.Speed, 0.01f));
            float halfLengths = (previousType.prefab.Length + plannedType.prefab.Length) * 0.5f;
            float extraTime = Random.Range(0f, randomExtraTime) + easyExtraTime * (1f - gm.Difficulty);

            if (plannedLane == lastLane)
            {
                // Mesma calçada: o jogador nem precisa agir, só legibilidade.
                return halfLengths + minSameLaneGap + speedOnArrival * extraTime * 0.5f;
            }

            // Calçada oposta: o jogador precisa esperar o anterior passar e trocar.
            float neededTime = reactionTime + player.SwitchDuration + extraTime;
            return halfLengths + playerDepth + speedOnArrival * neededTime;
        }

        private void EnqueuePattern()
        {
            float d = gm.Difficulty;
            float wSingle = Mathf.Lerp(3f, 1f, d);
            float wZigZag = Mathf.Lerp(1f, 3f, d);
            const float wWall = 1.2f;

            float roll = Random.Range(0f, wSingle + wZigZag + wWall);
            Pattern pattern = roll < wSingle ? Pattern.Single
                            : roll < wSingle + wZigZag ? Pattern.ZigZag
                            : Pattern.Wall;

            int lane = lastLane;
            switch (pattern)
            {
                case Pattern.Single:
                    pendingLanes.Enqueue(Random.Range(0, 2));
                    break;

                case Pattern.ZigZag:
                    int zigCount = Random.Range(3, 4 + Mathf.RoundToInt(d * 3f));
                    for (int i = 0; i < zigCount; i++)
                    {
                        lane = 1 - lane;
                        pendingLanes.Enqueue(lane);
                    }
                    break;

                case Pattern.Wall:
                    // Vários seguidos na mesma calçada: tenta o jogador a um near-miss
                    // arriscado para depois voltar.
                    lane = 1 - lane;
                    int wallCount = Random.Range(2, 5);
                    for (int i = 0; i < wallCount; i++) pendingLanes.Enqueue(lane);
                    break;
            }
        }

        private ObstacleType PickType()
        {
            float d = gm.Difficulty;
            float total = 0f;
            foreach (ObstacleType t in types)
            {
                if (t.minDifficulty <= d) total += t.weight;
            }

            float roll = Random.Range(0f, total);
            foreach (ObstacleType t in types)
            {
                if (t.minDifficulty > d) continue;
                roll -= t.weight;
                if (roll <= 0f) return t;
            }
            return types[0];
        }
    }
}
