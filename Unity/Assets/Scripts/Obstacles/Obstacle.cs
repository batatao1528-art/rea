using Atrasado.Core;
using UnityEngine;

namespace Atrasado.Obstacles
{
    /// <summary>
    /// Obstáculo que vem na direção do jogador. Parado (vovó, bueiro, cachorro)
    /// ou com velocidade própria (patinete). Volta para o pool ao sair da tela.
    /// Requisitos: Collider marcado como Trigger (~15% menor que o modelo).
    /// </summary>
    [RequireComponent(typeof(Collider))]
    public class Obstacle : MonoBehaviour
    {
        [Tooltip("Velocidade própria em direção ao jogador (ex: patinete). 0 = parado.")]
        [SerializeField] private float ownSpeed = 0f;
        [Tooltip("Comprimento no eixo Z, usado pelo spawner e pelo near-miss.")]
        [SerializeField] private float length = 1f;

        public float OwnSpeed => ownSpeed;
        public float Length => length;
        public int Lane { get; private set; }
        public bool NearMissClaimed { get; set; }

        public float ClosingSpeed => GameManager.Instance.Speed + ownSpeed;
        public float FrontZ => transform.position.z - length * 0.5f;
        public float BackZ => transform.position.z + length * 0.5f;

        private ObstacleSpawner owner;

        public void Activate(ObstacleSpawner spawner, int lane, Vector3 position)
        {
            owner = spawner;
            Lane = lane;
            NearMissClaimed = false;
            transform.position = position;
        }

        private void Update()
        {
            // O mundo congela na morte: a câmera lenta fica só na animação do Zé.
            if (GameManager.Instance.State != GameState.Playing) return;

            transform.position += Vector3.back * (ClosingSpeed * Time.deltaTime);
            if (BackZ < owner.DespawnZ) owner.Despawn(this);
        }

        private void OnTriggerEnter(Collider other)
        {
            if (other.CompareTag("Player")) GameManager.Instance.KillPlayer(gameObject);
        }
    }
}
