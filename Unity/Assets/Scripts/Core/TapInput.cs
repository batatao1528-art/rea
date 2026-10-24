using UnityEngine;
using UnityEngine.EventSystems;

namespace Atrasado.Core
{
    /// <summary>
    /// O único input do jogo: "tocou na tela neste frame?".
    /// Toques sobre botões de UI (ex: "Continuar") são ignorados, e um toque
    /// pode ser consumido para que dois sistemas não reajam ao mesmo toque
    /// (ex: o toque que inicia a partida não deve também trocar de calçada).
    /// </summary>
    public static class TapInput
    {
        private static int consumedFrame = -1;

        public static bool Tapped()
        {
            if (consumedFrame == Time.frameCount) return false;

            for (int i = 0; i < Input.touchCount; i++)
            {
                Touch touch = Input.GetTouch(i);
                if (touch.phase == TouchPhase.Began && !IsOverUI(touch.fingerId)) return true;
            }

            // Mouse/teclado para testar no Editor. Toques já foram tratados acima.
            if (Input.touchCount == 0)
            {
                if (Input.GetMouseButtonDown(0) && !IsOverUI(-1)) return true;
                if (Input.GetKeyDown(KeyCode.Space)) return true;
            }
            return false;
        }

        public static void Consume() => consumedFrame = Time.frameCount;

        private static bool IsOverUI(int pointerId)
        {
            return EventSystem.current != null && EventSystem.current.IsPointerOverGameObject(pointerId);
        }
    }
}
