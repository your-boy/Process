package com.process;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

@SpringBootTest
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.mail.host=localhost",
        "spring.mail.port=25",
        "app.jwt.secret=TestSecretKeyMustBeAtLeast256BitsLongForHS256Algorithm",
        "app.jwt.expiration=86400000"
})
class ProcessApplicationTest {

    @Test
    void contextLoads() {
    }
}
