// Assina um APK (esquemas v1, v2 e v3) e alinha as entradas sem compressão, usando a biblioteca apksig.
// Uso: java -cp apksig.jar SignApk.java ENTRADA.apk SAIDA.apk KEYSTORE SENHA ALIAS
import com.android.apksig.ApkSigner;
import java.io.File;
import java.io.FileInputStream;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.cert.X509Certificate;
import java.util.List;

public class SignApk {
    public static void main(String[] args) throws Exception {
        char[] pass = args[3].toCharArray();
        KeyStore ks = KeyStore.getInstance("PKCS12");
        try (FileInputStream in = new FileInputStream(args[2])) { ks.load(in, pass); }
        PrivateKey key = (PrivateKey) ks.getKey(args[4], pass);
        X509Certificate cert = (X509Certificate) ks.getCertificate(args[4]);
        ApkSigner.SignerConfig signer = new ApkSigner.SignerConfig.Builder("assistente", key, List.of(cert)).build();
        new ApkSigner.Builder(List.of(signer))
            .setInputApk(new File(args[0]))
            .setOutputApk(new File(args[1]))
            .setV1SigningEnabled(true)
            .setV2SigningEnabled(true)
            .setV3SigningEnabled(true)
            .build()
            .sign();
    }
}
