4.1 Установка базы данных

    Установите PostgreSQL с помощью Helm:

    helm repo add bitnami https://charts.bitnami.com/bitnami
    helm install postgresql bitnami/postgresql -f values.yaml

    Убедитесь, что вы заменили <your_db_username> и <your_db_password> в values.yaml на реальные значения.

4.2 Применение первоначальных миграций

    Примените первоначальные миграции:

    kubectl apply -f job.yaml

    Убедитесь, что команду миграции в job.yaml корректно настроили.

4.3 Развертывание приложения

    
