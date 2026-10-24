using System;
using Atrasado.Core;
using UnityEngine;

namespace Atrasado.Player
{
    /// <summary>
    /// 1 toque = troca de calçada. Só isso.
    /// O toque nunca é ignorado: tocar no meio de uma troca inverte a direção
    /// na hora, então o jogador sempre sente que o controle é dele.
    ///
    /// Requisitos no GameObject: tag "Player", Collider marcado como Trigger
    /// (~15% menor que o modelo) e Rigidbody kinematic.
    /// </summary>
    [RequireComponent(typeof(Collider))]
    public class PlayerLaneSwitcher : MonoBehaviour
    {
        [SerializeField] private float laneOffset = 1.6f;
        [Tooltip("Duração (s) de uma troca completa entre calçadas.")]
        [SerializeField] private float switchDuration = 0.12f;
        [Tooltip("0 = esquerda, 1 = direita.")]
        [SerializeField] private int startLane = 1;

        [Header("Juice (só no visual, não afeta a hitbox)")]
        [SerializeField] private Transform visual;
        [SerializeField] private float hopHeight = 0.35f;
        [SerializeField] private float squash = 0.25f;

        [Header("Som")]
        [SerializeField] private AudioSource sfx;
        [SerializeField] private AudioClip switchClip;

        /// <summary>Calçada de destino (onde o jogador estará ao fim da troca).</summary>
        public int Lane { get; private set; }
        public float SwitchDuration => switchDuration;

        /// <summary>(calçada de origem, calçada de destino)</summary>
        public event Action<int, int> LaneSwitched;

        private GameManager gm;
        private float fromX;
        private float toX;
        private float progress = 1f;
        private float currentDuration;

        public float LaneX(int lane) => lane == 0 ? -laneOffset : laneOffset;

        private void Start()
        {
            gm = GameManager.Instance;
            gm.RunReset += ResetPlayer;
            ResetPlayer();
        }

        private void OnDestroy()
        {
            if (gm != null) gm.RunReset -= ResetPlayer;
        }

        private void Update()
        {
            if (gm.State != GameState.Playing) return;

            if (TapInput.Tapped())
            {
                TapInput.Consume();
                Switch();
            }
            Animate(Time.deltaTime);
        }

        private void Switch()
        {
            int from = Lane;
            Lane = 1 - Lane;

            fromX = transform.localPosition.x;
            toX = LaneX(Lane);
            // Inversão no meio da troca: a duração é proporcional ao caminho restante.
            currentDuration = switchDuration * Mathf.Abs(toX - fromX) / (2f * laneOffset);
            progress = 0f;

            if (sfx != null && switchClip != null) sfx.PlayOneShot(switchClip);
            LaneSwitched?.Invoke(from, Lane);
        }

        private void Animate(float dt)
        {
            if (progress >= 1f) return;

            progress = currentDuration <= 0f ? 1f : Mathf.Min(1f, progress + dt / currentDuration);
            float eased = 1f - (1f - progress) * (1f - progress); // ease-out: sai rápido do perigo

            Vector3 p = transform.localPosition;
            p.x = Mathf.Lerp(fromX, toX, eased);
            transform.localPosition = p;

            if (visual != null)
            {
                float arc = Mathf.Sin(progress * Mathf.PI);
                visual.localPosition = new Vector3(0f, arc * hopHeight, 0f);
                visual.localScale = new Vector3(1f + arc * squash, 1f - arc * squash, 1f);
            }
        }

        private void ResetPlayer()
        {
            Lane = startLane;
            progress = 1f;

            Vector3 p = transform.localPosition;
            p.x = LaneX(Lane);
            transform.localPosition = p;

            if (visual != null)
            {
                visual.localPosition = Vector3.zero;
                visual.localScale = Vector3.one;
            }
        }
    }
}
