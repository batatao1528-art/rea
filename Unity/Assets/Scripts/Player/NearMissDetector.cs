using System;
using Atrasado.Core;
using Atrasado.Obstacles;
using UnityEngine;

namespace Atrasado.Player
{
    /// <summary>
    /// "POR UM TRIZ!": trocar de calçada no último instante antes de um obstáculo
    /// dá pontos, câmera lenta e aumenta o combo. Transforma um input binário em
    /// uma decisão de risco — o jogador ESCOLHE esperar até o último milissegundo.
    /// </summary>
    [RequireComponent(typeof(PlayerLaneSwitcher))]
    public class NearMissDetector : MonoBehaviour
    {
        [SerializeField] private ObstacleSpawner spawner;

        [Tooltip("Janela em segundos (não em metros) antes do impacto que conta como near-miss. " +
                 "Em tempo, a dificuldade do near-miss é constante em qualquer velocidade.")]
        [SerializeField] private float nearMissWindow = 0.15f;
        [SerializeField] private int basePoints = 10;
        [Tooltip("Segundos sem near-miss até o combo zerar.")]
        [SerializeField] private float comboTimeout = 2.5f;

        [Header("Slow-mo")]
        [SerializeField] private float slowMoScale = 0.35f;
        [SerializeField] private float slowMoDuration = 0.25f;

        [Header("Som (pitch sobe a cada combo: dó-ré-mi...)")]
        [SerializeField] private AudioSource sfx;
        [SerializeField] private AudioClip nearMissClip;
        [SerializeField] private float pitchStepPerCombo = 0.06f;

        public int Combo { get; private set; }
        public int BestComboThisRun { get; private set; }

        /// <summary>(combo atual, pontos ganhos)</summary>
        public event Action<int, int> NearMiss;
        public event Action ComboBroken;

        private GameManager gm;
        private PlayerLaneSwitcher player;
        private float lastNearMissTime;

        private void Start()
        {
            gm = GameManager.Instance;
            player = GetComponent<PlayerLaneSwitcher>();
            player.LaneSwitched += OnLaneSwitched;
            gm.RunReset += ResetCombo;
        }

        private void OnDestroy()
        {
            if (player != null) player.LaneSwitched -= OnLaneSwitched;
            if (gm != null) gm.RunReset -= ResetCombo;
        }

        private void Update()
        {
            if (Combo > 0 && gm.State == GameState.Playing && Time.time - lastNearMissTime > comboTimeout)
            {
                Combo = 0;
                ComboBroken?.Invoke();
            }
        }

        private void OnLaneSwitched(int fromLane, int toLane)
        {
            float playerZ = transform.position.z;

            foreach (Obstacle obstacle in spawner.Active)
            {
                if (obstacle.Lane != fromLane || obstacle.NearMissClaimed) continue;

                float gap = obstacle.FrontZ - playerZ;
                if (gap < 0f || gap > obstacle.ClosingSpeed * nearMissWindow) continue;

                obstacle.NearMissClaimed = true;
                Combo++;
                BestComboThisRun = Mathf.Max(BestComboThisRun, Combo);
                lastNearMissTime = Time.time;

                int points = basePoints * Combo;
                gm.AddBonus(points);
                gm.PlaySlowMo(slowMoScale, slowMoDuration);

                if (sfx != null && nearMissClip != null)
                {
                    sfx.pitch = 1f + (Combo - 1) * pitchStepPerCombo;
                    sfx.PlayOneShot(nearMissClip);
                }

                NearMiss?.Invoke(Combo, points);
                break; // um near-miss por toque
            }
        }

        private void ResetCombo()
        {
            Combo = 0;
            BestComboThisRun = 0;
        }
    }
}
