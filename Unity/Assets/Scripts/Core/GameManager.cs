using System;
using System.Collections;
using UnityEngine;

namespace Atrasado.Core
{
    public enum GameState { Ready, Playing, Dead }

    /// <summary>
    /// Estado da partida, velocidade crescente, distância, pontuação e reinício instantâneo.
    /// O jogador fica parado em z = 0 e o mundo vem até ele (evita problemas de
    /// precisão de float numa corrida infinita).
    /// </summary>
    public class GameManager : MonoBehaviour
    {
        public static GameManager Instance { get; private set; }

        [Header("Velocidade")]
        [SerializeField] private float startSpeed = 9f;
        [SerializeField] private float maxSpeed = 24f;
        [Tooltip("m/s ganhos por segundo de partida.")]
        [SerializeField] private float acceleration = 0.18f;

        [Header("Ônibus")]
        [Tooltip("A cada quantos metros o ônibus para no ponto (meta de curto prazo).")]
        [SerializeField] private float busStopInterval = 1000f;

        [Header("Morte / Revanche")]
        [SerializeField] private float deathSlowMoScale = 0.2f;
        [SerializeField] private float deathSlowMoDuration = 0.6f;
        [Tooltip("Tempo real mínimo antes de aceitar o toque de revanche (evita reinício acidental).")]
        [SerializeField] private float restartLockout = 0.5f;

        private const string BestKey = "best_distance";
        private const float DefaultFixedDeltaTime = 0.02f;

        public GameState State { get; private set; } = GameState.Ready;
        public float Speed { get; private set; }
        public float Distance { get; private set; }
        public int BonusScore { get; private set; }
        public int Score => Mathf.FloorToInt(Distance) + BonusScore;
        public int BestDistance { get; private set; }
        public bool IsNewRecord { get; private set; }
        public bool UsedRevive { get; private set; }

        /// <summary>"Faltaram X m pro busão!"</summary>
        public float DistanceToBus => nextBusStop - Distance;
        /// <summary>"Faltaram X m pro seu recorde!"</summary>
        public float DistanceToBest => Mathf.Max(0f, BestDistance - Distance);
        /// <summary>0 no início, 1 na velocidade máxima.</summary>
        public float Difficulty => Mathf.InverseLerp(startSpeed, maxSpeed, Speed);

        public event Action RunStarted;
        public event Action RunReset;
        public event Action Revived;
        public event Action BusReached;
        public event Action<GameObject> PlayerDied;

        private float nextBusStop;
        private float deathRealTime;
        private Coroutine slowMoRoutine;

        private void Awake()
        {
            if (Instance != null && Instance != this) { Destroy(gameObject); return; }
            Instance = this;
            Application.targetFrameRate = 60;
            BestDistance = PlayerPrefs.GetInt(BestKey, 0);
            ResetRunState();
        }

        private void Update()
        {
            switch (State)
            {
                case GameState.Ready:
                    if (TapInput.Tapped()) { TapInput.Consume(); StartRun(); }
                    break;

                case GameState.Playing:
                    Speed = Mathf.Min(maxSpeed, Speed + acceleration * Time.deltaTime);
                    Distance += Speed * Time.deltaTime;
                    if (Distance >= nextBusStop)
                    {
                        nextBusStop += busStopInterval;
                        BusReached?.Invoke();
                    }
                    break;

                case GameState.Dead:
                    // Revanche com 1 toque, sem menus no caminho.
                    if (Time.unscaledTime - deathRealTime >= restartLockout && TapInput.Tapped())
                    {
                        TapInput.Consume();
                        Restart();
                    }
                    break;
            }
        }

        /// <summary>Velocidade prevista daqui a <paramref name="seconds"/> segundos de partida.</summary>
        public float SpeedAfter(float seconds) => Mathf.Min(maxSpeed, Speed + acceleration * seconds);

        public void AddBonus(int points) => BonusScore += points;

        public void KillPlayer(GameObject killer)
        {
            if (State != GameState.Playing) return;

            State = GameState.Dead;
            deathRealTime = Time.unscaledTime;

            int distance = Mathf.FloorToInt(Distance);
            IsNewRecord = distance > BestDistance;
            if (IsNewRecord)
            {
                BestDistance = distance;
                PlayerPrefs.SetInt(BestKey, BestDistance);
                PlayerPrefs.Save();
            }

            PlayerDied?.Invoke(killer);
            PlaySlowMo(deathSlowMoScale, deathSlowMoDuration);
        }

        /// <summary>
        /// "Continuar" — chamar no callback de sucesso do anúncio recompensado.
        /// Só 1 vez por partida para não desvalorizar a recompensa.
        /// </summary>
        public void Revive()
        {
            if (State != GameState.Dead || UsedRevive) return;
            UsedRevive = true;
            StopSlowMo();
            State = GameState.Playing;
            Revived?.Invoke();
        }

        public void Restart()
        {
            ResetRunState();
            RunReset?.Invoke();
            StartRun();
        }

        public void PlaySlowMo(float scale, float realDuration)
        {
            StopSlowMo();
            slowMoRoutine = StartCoroutine(SlowMo(scale, realDuration));
        }

        private void StartRun()
        {
            State = GameState.Playing;
            RunStarted?.Invoke();
        }

        private void ResetRunState()
        {
            StopSlowMo();
            Speed = startSpeed;
            Distance = 0f;
            BonusScore = 0;
            IsNewRecord = false;
            UsedRevive = false;
            nextBusStop = busStopInterval;
        }

        private IEnumerator SlowMo(float scale, float realDuration)
        {
            SetTimeScale(scale);
            yield return new WaitForSecondsRealtime(realDuration);
            SetTimeScale(1f);
            slowMoRoutine = null;
        }

        private void StopSlowMo()
        {
            if (slowMoRoutine != null) StopCoroutine(slowMoRoutine);
            slowMoRoutine = null;
            SetTimeScale(1f);
        }

        private static void SetTimeScale(float scale)
        {
            Time.timeScale = scale;
            Time.fixedDeltaTime = DefaultFixedDeltaTime * scale;
        }
    }
}
