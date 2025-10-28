package com.boorise.app;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

@SpringBootTest
class BooriseApplicationTests {

    @Test
    void contextLoads() {
        // Démarre le contexte Spring et s'arrête => passe si aucune exception
    }

    @Test
    void mainRuns() {
        assertDoesNotThrow(() -> BooriseApplication.main(new String[]{}));
    }
}
