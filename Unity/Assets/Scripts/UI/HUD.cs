using Atrasado.Core;
using Atrasado.Player;
using TMPro;
using UnityEngine;

namespace Atrasado.UI
{
    /// <summary>
    /// HUD mínimo. A tela de derrota é desenhada para o "quase": sempre mostra
    /// quanto faltou para o ônibus e para o recorde.
    /// </summary>
    public class HUD : MonoBehaviour
    {
        [SerializeField] private NearMissDetector nearMiss;

        [Header("Durante a partida")]
        [SerializeField] private TMP_Text scoreText;
        [SerializeField] private TMP_Text busText;
        [SerializeField] private TMP_Text comboText;
        [SerializeField] private float comboPopDuration = 0.8f;

        [Header("Telas")]
        [SerializeField] private GameObject tapToStart;
        [SerializeField] private GameObject gameOverPanel;
        [SerializeField] private TMP_Text gameOverTitle;
        [SerializeField] private TMP_Text gameOverDetails;
        [SerializeField] private GameObject continueButton;

        private GameManager gm;
        private float comboHideTime;

        private void Start()
        {
            gm = GameManager.Instance;
            gm.RunStarted += ShowPlaying;
            gm.Revived += ShowPlaying;
            gm.PlayerDied += ShowGameOver;
            nearMiss.NearMiss += ShowCombo;

            tapToStart.SetActive(true);
            gameOverPanel.SetActive(false);
            comboText.gameObject.SetActive(false);
        }

        private void OnDestroy()
        {
            if (gm != null)
            {
                gm.RunStarted -= ShowPlaying;
                gm.Revived -= ShowPlaying;
                gm.PlayerDied -= ShowGameOver;
            }
            if (nearMiss != null) nearMiss.NearMiss -= ShowCombo;
        }

        private void Update()
        {
            scoreText.text = gm.Score.ToString();
            busText.text = $"Busão: {Mathf.CeilToInt(gm.DistanceToBus)}m";

            if (comboText.gameObject.activeSelf && Time.unscaledTime >= comboHideTime)
                comboText.gameObject.SetActive(false);
        }

        private void ShowPlaying()
        {
            tapToStart.SetActive(false);
            gameOverPanel.SetActive(false);
        }

        private void ShowCombo(int combo, int points)
        {
            comboText.text = combo > 1 ? $"POR UM TRIZ! x{combo}\n+{points}" : $"POR UM TRIZ!\n+{points}";
            comboText.gameObject.SetActive(true);
            comboHideTime = Time.unscaledTime + comboPopDuration;
        }

        private void ShowGameOver(GameObject killer)
        {
            gameOverPanel.SetActive(true);
            int toBus = Mathf.CeilToInt(gm.DistanceToBus);

            gameOverTitle.text = gm.IsNewRecord ? "NOVO RECORDE!" : $"Faltaram {toBus}m pro busão!";
            gameOverDetails.text = gm.IsNewRecord
                ? $"{Mathf.FloorToInt(gm.Distance)}m — mais que o caminho até a padaria!"
                : $"Faltaram {Mathf.CeilToInt(gm.DistanceToBest)}m pro seu recorde ({gm.BestDistance}m)\nToque para tentar de novo";

            // Oferecer "Continuar" só quando o desejo é máximo: perto do recorde ou do ônibus.
            bool closeToSomething = toBus < 150 || gm.DistanceToBest < 150 || gm.IsNewRecord;
            continueButton.SetActive(!gm.UsedRevive && closeToSomething);
        }

        /// <summary>Ligado ao botão "Continuar". Troque o corpo pela chamada do seu SDK de anúncios.</summary>
        public void OnContinuePressed()
        {
            // Ex.: AdsService.ShowRewarded(onRewarded: gm.Revive);
            gm.Revive();
        }
    }
}
